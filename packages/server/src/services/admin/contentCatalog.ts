import { sql } from 'kysely';
import { z } from 'zod';

import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { writeAudit, type RequestMeta } from './audit';
import { staffNames } from './contentSkills';
import { dbRole, type Staff } from './permissions';

/**
 * The rest of the admin portal's Content area (toreview §171.13): new templates, template usage,
 * the rubric's rationale, the KB's own counts and the prompts' thirty-day figures. Counts are
 * aggregates; every change writes an audit row in the same transaction.
 */

const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;

// --- Templates -----------------------------------------------------------------------------

export const newTemplateSchema = z.object({ name: z.string().trim().min(1).max(120), basedOn: z.string().max(120) }).strict();

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/**
 * A new template starts as a draft copy of an existing one. Templates render from code
 * (`export/latex`), so the copy renders as its base until its own layout ships, and it cannot be
 * published until it passes the parse-back certification (Q-06): `certified_at` starts empty, and
 * the publish route refuses an uncertified template.
 */
export async function createTemplate(db: Database, staff: Staff, input: z.output<typeof newTemplateSchema>, meta: RequestMeta) {
  const base = slugOf(input.name);
  if (!base) throw errors.validation({ name: 'empty' }, 'Give the template a name with letters or digits.');
  return db.withUser(staffDb(staff), async (tx) => {
    const from = await tx.selectFrom('resume_templates').select(['id', 'slug', 'ats_safe', 'assets']).where('slug', '=', input.basedOn).executeTakeFirst();
    if (!from) throw errors.notFound('template');
    const sameName = await tx.selectFrom('resume_templates').select('slug').where(sql`lower(name)`, '=', input.name.toLowerCase()).executeTakeFirst();
    if (sameName) throw errors.conflict('A template with that name already exists.');
    const taken = await tx.selectFrom('resume_templates').select('slug').where((eb) => eb.or([eb('slug', '=', base), eb('slug', 'like', `${base}-%`)])).execute();
    let slug = base;
    for (let n = 2; taken.some((t) => t.slug === slug); n += 1) slug = `${base}-${n}`;
    const basedOn = (from.assets as { basedOn?: unknown } | null)?.basedOn;
    const assets = { ...(from.assets as object), basedOn: typeof basedOn === 'string' ? basedOn : from.slug };
    const created = await tx
      .insertInto('resume_templates')
      .values({ slug, name: input.name, ats_safe: from.ats_safe, certified_at: null, status: 'draft', assets: JSON.stringify(assets) })
      .returning(['id', 'slug', 'name', 'ats_safe', 'certified_at', 'status', 'updated_at', 'assets'])
      .executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'template.create', targetType: 'template', targetId: slug, after: { name: input.name, basedOn: from.slug } }, meta);
    return created;
  });
}

/** Per template: the resumes that use it (live ones, not trashed) and the template it copies. */
export async function templateUsage(db: Database, staff: Staff) {
  const templates = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('resume_templates').select(['id', 'slug', 'assets']).execute());
  const counts = await db.withSystem('admin: resumes per template (aggregate)', (tx) =>
    tx.selectFrom('resumes').select(['template_id', sql<number>`count(*)::int`.as('n')]).where('template_id', 'is not', null).where('trashed_at', 'is', null).groupBy('template_id').execute(),
  );
  const byId = new Map(counts.map((r) => [r.template_id, r.n]));
  return templates.map((t) => {
    const basedOn = (t.assets as { basedOn?: unknown } | null)?.basedOn;
    return { slug: t.slug, inUse: byId.get(t.id) ?? 0, basedOn: typeof basedOn === 'string' ? basedOn : null };
  });
}

// --- The rubric's rationale ----------------------------------------------------------------

/** `version` is the version the editor loaded: an edit to anything but the current one is refused. */
export const rationaleSchema = z.object({ version: z.string().min(1).max(20), paragraphs: z.array(z.string().trim().min(1).max(2000)).min(1).max(12) }).strict();

/**
 * The current version's rationale, with who last edited it. The weights and bands are the engines'
 * code (`rubric-2`) and are not edited here; publishing a new version ships with an engines release.
 */
export async function rubricRationale(db: Database, staff: Staff) {
  const row = await db.withUser(staffDb(staff), (tx) =>
    tx.selectFrom('rubric_versions').select(['version', 'rationale', 'evidence', 'rationale_updated_by', 'rationale_updated_at', 'created_at']).where('is_current', '=', true).executeTakeFirst(),
  );
  if (!row) return null;
  const names = await staffNames(db, [row.rationale_updated_by]);
  return {
    version: row.version,
    paragraphs: row.rationale.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    evidence: row.evidence,
    updatedBy: row.rationale_updated_by ? (names.get(row.rationale_updated_by) ?? null) : null,
    updatedAt: row.rationale_updated_at ? row.rationale_updated_at.toISOString() : null,
  };
}

export async function saveRationale(db: Database, staff: Staff, input: z.output<typeof rationaleSchema>, meta: RequestMeta) {
  const text = input.paragraphs.join('\n\n');
  await db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('rubric_versions').select(['id', 'version', 'rationale']).where('is_current', '=', true).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('rubric version');
    if (before.version !== input.version) throw errors.conflict(`The current rubric is ${before.version} now. Reload and edit its rationale.`);
    if (before.rationale === text) return;
    await tx.updateTable('rubric_versions').set({ rationale: text, rationale_updated_by: staff.identity.userId, rationale_updated_at: new Date() }).where('id', '=', before.id).execute();
    await writeAudit(tx, staff, { action: 'rubric.rationale', targetType: 'rubric', targetId: before.version, before: { rationale: before.rationale }, after: { rationale: text } }, meta);
  });
  return rubricRationale(db, staff);
}

// --- The Technology KB's counts --------------------------------------------------------------

/** Exact counts, so the KB page needn't count a capped list. */
export async function kbStats(db: Database, staff: Staff) {
  return db.withUser(staffDb(staff), async (tx) => {
    const tech = await tx
      .selectFrom('technologies')
      .select([
        sql<number>`count(*)::int`.as('total'),
        sql<number>`count(*) filter (where created_at > now() - interval '30 days')::int`.as('added30d'),
        sql<number>`count(*) filter (where review_status <> 'published')::int`.as('inReview'),
      ])
      .executeTakeFirstOrThrow();
    return tech;
  });
}

// --- Prompts: the last thirty days -----------------------------------------------------------

/**
 * The prompts page's two figures, for the last thirty days and the thirty before. The eval pass
 * rate is finished evaluations that passed, of those that passed or failed (an `unsupported` run
 * proved nothing either way). Cost per resume is the model spend recorded against resume runs that
 * finished, divided by those runs. A figure is `null` for a window in which nothing measured it.
 */
export async function promptFigures(db: Database) {
  return db.withSystem('admin: prompt figures (aggregate)', async (tx) => {
    const window = (fromDays: number, toDays: number) => ({
      from: sql<Date>`now() - make_interval(days => ${fromDays})`,
      to: sql<Date>`now() - make_interval(days => ${toDays})`,
    });
    const figures = async (fromDays: number, toDays: number) => {
      const { from, to } = window(fromDays, toDays);
      const evals = await tx
        .selectFrom('prompt_evaluations')
        .select([sql<number>`count(*) filter (where status = 'passed')::int`.as('passed'), sql<number>`count(*) filter (where status in ('passed', 'failed'))::int`.as('decided')])
        .where('created_at', '>', from)
        .where('created_at', '<=', to)
        .executeTakeFirstOrThrow();
      const resumes = await tx
        .selectFrom('generations as g')
        .leftJoin('ai_calls as a', 'a.generation_id', 'g.id')
        .select([sql<number>`count(distinct g.id)::int`.as('runs'), sql<string>`coalesce(sum(a.cost_micros), 0)::text`.as('micros')])
        .where('g.kind', '=', 'resume')
        .where('g.status', '=', 'ready')
        .where('g.created_at', '>', from)
        .where('g.created_at', '<=', to)
        .executeTakeFirstOrThrow();
      return {
        evalPassRate: evals.decided > 0 ? evals.passed / evals.decided : null,
        evaluations: evals.decided,
        costPerResumeUsd: resumes.runs > 0 ? Number(resumes.micros) / 1e6 / resumes.runs : null,
        resumeRuns: resumes.runs,
      };
    };
    return { current: await figures(30, 0), previous: await figures(60, 30) };
  });
}
