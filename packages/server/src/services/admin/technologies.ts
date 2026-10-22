import { sql } from 'kysely';
import { z } from 'zod';

import type { Database } from '../../db/database';
import { AppError, errors } from '../../http/errors';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * Technology KB curation (ImBackendImplementationPlan P12-04; spec §7.7, §7.17, Q-02, Q-09). Full
 * CRUD, a review queue (machine-seeded entries and the unknown technologies the pipeline queued,
 * plus users' "flag this" reports), a bulk import that imports the valid rows and lists the rest,
 * and dataset versions. Approving or publishing an entry with a date needs a cited source (a check
 * in the table enforces it too); only published entries reach the Skills Explorer.
 */

const year = z.number().int().min(1940).max(2100);
export const technologyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120).optional(),
    category: z.string().trim().min(1).max(80),
    aliases: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    releaseYear: year.nullable().optional(),
    safeUsageYear: year.nullable().optional(),
    enterpriseAdoptionYear: year.nullable().optional(),
    latestVersion: z.string().max(40).nullable().optional(),
    sourceCitation: z.string().url().max(500).nullable().optional(),
    reviewStatus: z.enum(['llm_seeded', 'admin_reviewed', 'published']).default('admin_reviewed'),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.releaseYear != null && t.safeUsageYear != null && t.safeUsageYear < t.releaseYear) ctx.addIssue({ code: 'custom', path: ['safeUsageYear'], message: 'cannot be before the release year' });
    if (t.safeUsageYear != null && t.enterpriseAdoptionYear != null && t.safeUsageYear > t.enterpriseAdoptionYear) ctx.addIssue({ code: 'custom', path: ['enterpriseAdoptionYear'], message: 'cannot be before the safe-usage year' });
    if (t.reviewStatus !== 'llm_seeded' && t.releaseYear != null && !t.sourceCitation) ctx.addIssue({ code: 'custom', path: ['sourceCitation'], message: 'a reviewed date needs a cited source' });
  });
export type TechnologyInput = z.input<typeof technologyInputSchema>;

const slugOf = (name: string) => name.toLowerCase().replace(/\+/g, 'p').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;

const toValues = (t: z.output<typeof technologyInputSchema>, datasetVersion: number) => ({
  name: t.name,
  slug: t.slug ?? slugOf(t.name),
  category: t.category,
  aliases: t.aliases,
  release_year: t.releaseYear ?? null,
  safe_usage_year: t.safeUsageYear ?? null,
  enterprise_adoption_year: t.enterpriseAdoptionYear ?? null,
  latest_version: t.latestVersion ?? null,
  source_citation: t.sourceCitation ?? null,
  review_status: t.reviewStatus,
  dataset_version: datasetVersion,
});

async function currentDataset(db: Database, staff: Staff): Promise<number> {
  const row = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('kb_dataset_versions').select(sql<number>`max(version)`.as('v')).executeTakeFirst());
  return Number(row?.v ?? 1);
}

export async function listTechnologies(db: Database, staff: Staff, filters: { status?: string; q?: string }) {
  return db.withUser(staffDb(staff), (tx) => {
    let query = tx.selectFrom('technologies').selectAll().orderBy('name').limit(500);
    if (filters.status) query = query.where('review_status', '=', filters.status);
    if (filters.q) query = query.where(sql<boolean>`lower(name) like ${`%${filters.q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`}`);
    return query.execute();
  });
}

export async function createTechnology(db: Database, staff: Staff, input: TechnologyInput, meta: RequestMeta) {
  const parsed = technologyInputSchema.safeParse(input);
  if (!parsed.success) throw errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  const version = await currentDataset(db, staff);
  return db.withUser(staffDb(staff), async (tx) => {
    const row = await tx.insertInto('technologies').values(toValues(parsed.data, version)).onConflict((oc) => oc.column('slug').doNothing()).returningAll().executeTakeFirst();
    if (!row) throw errors.conflict('An entry with that name already exists.');
    await writeAudit(tx, staff, { action: 'kb.create', targetType: 'technology', targetId: row.id, after: parsed.data }, meta);
    return row;
  });
}

export async function updateTechnology(db: Database, staff: Staff, id: string, patch: Partial<TechnologyInput>, meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('technologies').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('technology');
    const merged = {
      name: before.name,
      slug: before.slug,
      category: before.category,
      aliases: before.aliases,
      releaseYear: before.release_year,
      safeUsageYear: before.safe_usage_year,
      enterpriseAdoptionYear: before.enterprise_adoption_year,
      latestVersion: before.latest_version,
      sourceCitation: before.source_citation,
      reviewStatus: before.review_status as 'llm_seeded' | 'admin_reviewed' | 'published',
      ...patch,
    };
    const parsed = technologyInputSchema.safeParse(merged);
    if (!parsed.success) throw errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    const after = await tx.updateTable('technologies').set(toValues(parsed.data, before.dataset_version)).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'kb.update', targetType: 'technology', targetId: id, before, after }, meta);
    return after;
  });
}

/** Approve (reviewed), publish (shown in the Explorer and allowed to hard-fail) or reject (removed). */
export async function reviewTechnology(db: Database, staff: Staff, id: string, decision: 'approve' | 'publish' | 'reject', meta: RequestMeta) {
  if (decision === 'reject') {
    return db.withUser(staffDb(staff), async (tx) => {
      const before = await tx.selectFrom('technologies').selectAll().where('id', '=', id).executeTakeFirst();
      if (!before) throw errors.notFound('technology');
      if (before.review_status === 'published') throw errors.conflict('A published entry is unpublished by editing it, not rejected.');
      await tx.deleteFrom('technologies').where('id', '=', id).execute();
      await writeAudit(tx, staff, { action: 'kb.reject', targetType: 'technology', targetId: id, before }, meta);
      return null;
    });
  }
  try {
    return await updateTechnology(db, staff, id, { reviewStatus: decision === 'publish' ? 'published' : 'admin_reviewed' }, meta);
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED') throw new AppError('VALIDATION_FAILED', 'Add a cited source for the release year before approving.', error.details);
    throw error;
  }
}

/** CSV (header row) or JSON (an array). Valid rows import; invalid ones are listed with why; nothing rolls back. */
export async function importTechnologies(db: Database, staff: Staff, input: { format: 'csv' | 'json'; content: string }, meta: RequestMeta) {
  const rows: Record<string, unknown>[] = input.format === 'json' ? parseJson(input.content) : parseCsv(input.content);
  const version = await currentDataset(db, staff);
  const imported: string[] = [];
  const failed: { row: number; errors: string[] }[] = [];
  for (const [index, raw] of rows.entries()) {
    const parsed = technologyInputSchema.safeParse(raw);
    if (!parsed.success) {
      failed.push({ row: index + 1, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`) });
      continue;
    }
    const inserted = await db.withUser(staffDb(staff), async (tx) => {
      const row = await tx.insertInto('technologies').values(toValues(parsed.data, version)).onConflict((oc) => oc.column('slug').doNothing()).returning('id').executeTakeFirst();
      if (row) await writeAudit(tx, staff, { action: 'kb.import', targetType: 'technology', targetId: row.id, after: parsed.data }, meta);
      return row;
    });
    if (inserted) imported.push(parsed.data.slug ?? slugOf(parsed.data.name));
    else failed.push({ row: index + 1, errors: ['slug: an entry with this name already exists'] });
  }
  return { imported, failed };
}

function parseJson(content: string): Record<string, unknown>[] {
  try {
    const value = JSON.parse(content) as unknown;
    if (!Array.isArray(value)) throw new Error('not an array');
    return value as Record<string, unknown>[];
  } catch {
    throw errors.validation({ content: 'a JSON array of entries' }, 'The file is not a JSON array of entries.');
  }
}

/** Minimal CSV: a header row; quoted fields with "" escapes; aliases split on "|"; years as numbers. */
function parseCsv(content: string): Record<string, unknown>[] {
  const lines: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.length)) lines.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.length)) lines.push(row);
  const [head, ...body] = lines;
  if (!head) return [];
  const numeric = new Set(['releaseYear', 'safeUsageYear', 'enterpriseAdoptionYear']);
  return body.map((cells) => {
    const out: Record<string, unknown> = {};
    head.forEach((key, i) => {
      const value = (cells[i] ?? '').trim();
      if (value === '') return;
      out[key.trim()] = key === 'aliases' ? value.split('|').map((a) => a.trim()).filter(Boolean) : numeric.has(key.trim()) ? Number(value) : value;
    });
    return out;
  });
}

/** The review queue: unknown technologies the pipeline met, and users' reports about a verdict (Q-09). */
export async function reviewQueue(db: Database, staff: Staff) {
  const pending = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('kb_review_queue').selectAll().where('status', 'in', ['pending', 'seeded']).orderBy('occurrences', 'desc').limit(200).execute());
  const flags = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: read the KB review flags', (tx) =>
    tx.selectFrom('quality_flags').select(['id', 'kind', 'subject', 'reason', 'status', 'created_at']).where('status', '=', 'open').orderBy('created_at').limit(200).execute(),
  );
  return {
    candidates: pending.map((p) => ({ name: p.name, occurrences: p.occurrences, status: p.status, technologyId: p.technology_id })),
    // Reports carry what was disputed and why, never who sent them.
    reports: flags.map((f) => ({ id: f.id, kind: f.kind, subject: f.subject, reason: f.reason, createdAt: new Date(f.created_at).toISOString() })),
  };
}

/** Closes a dataset version, so a past validation's KB state can be named (§7.7). */
export async function publishDataset(db: Database, staff: Staff, notes: string, meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const current = await tx.selectFrom('kb_dataset_versions').select(sql<number>`max(version)`.as('v')).executeTakeFirst();
    const version = Number(current?.v ?? 0) + 1;
    await tx.insertInto('kb_dataset_versions').values({ version, notes, published_at: new Date() }).execute();
    await writeAudit(tx, staff, { action: 'kb.dataset_publish', targetType: 'kb_dataset', targetId: String(version), after: { notes } }, meta);
    return { version };
  });
}
