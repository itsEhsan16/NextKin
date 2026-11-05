import { sql } from 'kysely';
import { z } from 'zod';

import type { Database, Tx } from '../../db/database';
import { errors } from '../../http/errors';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * The skills editor (admin portal, Content; toreview §171.13). It curates `app.skills`, the reviewed
 * copy of the skill taxonomy: canonical names, aliases, a category and a parent label. Live scoring
 * keeps the engines' compiled taxonomy (`@nextkin/engines/datasets/taxonomy`) until a release imports
 * the reviewed copy, so nothing here changes a live score on its own.
 *
 * Usage figures are aggregates over what people typed into their profiles and roles
 * (`profile_skills`, `experience_skills`), counted in distinct people, never listed per person. A term
 * is listed only once at least two people used it (`MIN_PEOPLE`), so a one-off phrase someone typed
 * never reaches staff. A merge suggestion is code's call, not a model's: an unmapped term whose loose
 * form (lower case, punctuation dropped, a trailing "js" dropped) equals a skill's name or alias.
 */

const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;

export const MIN_PEOPLE = 2;
const LIST_MAX = 50;

const name = z.string().trim().min(1).max(120);
const alias = z.string().trim().min(1).max(80);
export const aliasesSchema = z.array(alias).max(30);
export const newSkillSchema = z
  .object({ name, categoryId: z.string().max(60).nullable().optional(), parent: z.string().trim().max(80).optional(), aliases: aliasesSchema.default([]) })
  .strict();
export const skillQuerySchema = z.object({
  category: z.string().max(60).optional(),
  aliases: z.enum(['all', 'with', 'none']).default('all'),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(8),
  sort: z.enum(['asc', 'desc']).default('asc'),
});

/** How a term is compared for an exact mapping: case and spacing don't matter. */
export const termKey = (term: string) => term.trim().replace(/\s+/g, ' ').toLowerCase();
/** The engines mark an ambiguous alias with a leading `~`; it is the same word for matching. */
const plain = (alias: string) => alias.replace(/^~/, '');
/** The looser form a merge suggestion compares: "ReactJS", "React.js" and "react" agree. */
export function looseKey(term: string): string {
  const squeezed = termKey(plain(term)).replace(/[^a-z0-9+#]/g, '');
  return squeezed.length > 4 && squeezed.endsWith('js') ? squeezed.slice(0, -2) : squeezed;
}

/** "Marco K." for staff, from their own rows; staff are the only users named here. */
async function staffNames(db: Database, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (!wanted.length) return new Map();
  const rows = await db.withSystem('admin: staff display names for the content editors', (tx) =>
    tx.selectFrom('users').select(['id', 'first_name', 'last_name', 'email']).where('id', 'in', wanted).where('role', '<>', 'user').execute(),
  );
  return new Map(rows.map((r) => [r.id, r.first_name ? `${r.first_name}${r.last_name ? ` ${r.last_name.charAt(0)}.` : ''}` : r.email]));
}
export { staffNames };

interface TermRow {
  key: string;
  term: string;
  people: number;
  first_seen: Date;
}

/** Every term two or more people typed that no skill names, most used first. */
async function unmappedTerms(db: Database): Promise<TermRow[]> {
  const { rows } = await db.withSystem('admin: unmapped skill terms (aggregate)', (tx) =>
    sql<TermRow>`
      with typed as (
        select raw_name, user_id, created_at from app.profile_skills
        union all
        select raw_name, user_id, created_at from app.experience_skills
      ),
      terms as (
        select lower(regexp_replace(btrim(raw_name), '\\s+', ' ', 'g')) as key,
               mode() within group (order by btrim(raw_name)) as term,
               count(distinct user_id)::int as people,
               min(created_at) as first_seen
        from typed group by 1
      ),
      known as (
        select lower(canonical_name) as key from app.skills
        union
        select lower(ltrim(a, '~')) from app.skills, unnest(aliases) as a
      )
      select key, term, people, first_seen from terms
      where people >= ${MIN_PEOPLE} and key not in (select key from known)
      order by people desc, key
      limit 2000`.execute(tx),
  );
  return rows;
}

interface SkillRow {
  id: string;
  canonical_name: string;
  aliases: string[];
  category_id: string | null;
  parent: string | null;
  updated_at: Date;
  updated_by: string | null;
  created_at: Date;
}

async function allSkills(tx: Tx): Promise<SkillRow[]> {
  return tx.selectFrom('skills').select(['id', 'canonical_name', 'aliases', 'category_id', 'parent', 'updated_at', 'updated_by', 'created_at']).execute();
}

export interface MergeSuggestionWire {
  id: string;
  alias: string;
  targetId: string;
  target: string;
  seenIn: number;
  firstSeen: string;
}

/** Splits the unmapped terms into merge suggestions (a loose match to a skill) and the rest. */
function classify(terms: TermRow[], skills: SkillRow[], dismissed: Set<string>) {
  const byLoose = new Map<string, SkillRow>();
  for (const skill of skills) {
    for (const word of [skill.canonical_name, ...skill.aliases]) {
      const key = looseKey(word);
      if (key && !byLoose.has(key)) byLoose.set(key, skill);
    }
  }
  const merges: MergeSuggestionWire[] = [];
  const unmapped: TermRow[] = [];
  for (const term of terms) {
    const target = byLoose.get(looseKey(term.term));
    if (target && !dismissed.has(term.key)) {
      merges.push({ id: `merge:${term.key}`, alias: term.term, targetId: target.id, target: target.canonical_name, seenIn: term.people, firstSeen: term.first_seen.toISOString() });
    } else if (!target) {
      unmapped.push(term);
    }
  }
  return { merges, unmapped };
}

async function suggestions(db: Database, staff: Staff) {
  const [terms, { skills, dismissed }] = await Promise.all([
    unmappedTerms(db),
    db.withUser(staffDb(staff), async (tx) => ({
      skills: await allSkills(tx),
      dismissed: new Set((await tx.selectFrom('skill_merge_dismissals').select('term_key').execute()).map((r) => r.term_key)),
    })),
  ]);
  return { skills, ...classify(terms, skills, dismissed) };
}

export async function skillsOverview(db: Database, staff: Staff) {
  const { skills, merges, unmapped } = await suggestions(db, staff);
  const categories = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('skill_categories').select(['id', 'name']).orderBy('name').execute());
  const aliases = skills.reduce((sum, s) => sum + s.aliases.length, 0);
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    stats: {
      skills: skills.length,
      added30d: skills.filter((s) => s.created_at.getTime() > monthAgo).length,
      aliases,
      perSkill: skills.length ? Math.round((aliases / skills.length) * 10) / 10 : 0,
      merges: merges.length,
      unmapped: unmapped.length,
    },
    categories: categories.map((c) => ({ ...c, count: skills.filter((s) => s.category_id === c.id).length })),
    unmapped: unmapped.slice(0, LIST_MAX).map((t) => ({ term: t.term, seenIn: t.people })),
    merges: merges.slice(0, LIST_MAX),
    minPeople: MIN_PEOPLE,
  };
}

/** Distinct people whose typed skills name each of these skills (by name or alias). */
async function usage(db: Database, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { rows } = await db.withSystem('admin: skill usage counts (aggregate)', (tx) =>
    sql<{ id: string; people: number }>`
      with typed as (
        select lower(regexp_replace(btrim(raw_name), '\\s+', ' ', 'g')) as key, user_id from app.profile_skills
        union all
        select lower(regexp_replace(btrim(raw_name), '\\s+', ' ', 'g')), user_id from app.experience_skills
      ),
      words as (
        select s.id, lower(s.canonical_name) as key from app.skills s where s.id = any(${ids}::uuid[])
        union
        select s.id, lower(ltrim(a, '~')) from app.skills s, unnest(s.aliases) as a where s.id = any(${ids}::uuid[])
      )
      select w.id, count(distinct t.user_id)::int as people from words w join typed t on t.key = w.key group by w.id`.execute(tx),
  );
  return new Map(rows.map((r) => [r.id, r.people]));
}

async function toWire(db: Database, rows: SkillRow[]) {
  const [used, names] = await Promise.all([usage(db, rows.map((r) => r.id)), staffNames(db, rows.map((r) => r.updated_by))]);
  return rows.map((r) => ({
    id: r.id,
    name: r.canonical_name,
    aliases: r.aliases.map(plain),
    parent: r.parent ?? '',
    categoryId: r.category_id,
    usedIn: used.get(r.id) ?? 0,
    editedAt: r.updated_at.toISOString(),
    editedBy: r.updated_by ? (names.get(r.updated_by) ?? null) : null,
  }));
}

export async function listSkills(db: Database, staff: Staff, query: z.output<typeof skillQuerySchema>) {
  const { rows, total } = await db.withUser(staffDb(staff), async (tx) => {
    let base = tx.selectFrom('skills');
    if (query.category) base = base.where('category_id', '=', query.category);
    if (query.aliases === 'with') base = base.where(sql<boolean>`cardinality(aliases) > 0`);
    if (query.aliases === 'none') base = base.where(sql<boolean>`cardinality(aliases) = 0`);
    const q = query.q?.trim().toLowerCase();
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      base = base.where(sql<boolean>`(lower(canonical_name) like ${like} or exists (select 1 from unnest(aliases) a where lower(a) like ${like}))`);
    }
    const counted = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const page = await base
      .select(['id', 'canonical_name', 'aliases', 'category_id', 'parent', 'updated_at', 'updated_by', 'created_at'])
      .orderBy(sql`lower(canonical_name)`, query.sort)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute();
    return { rows: page, total: counted.n };
  });
  return { data: await toWire(db, rows), total, page: query.page, pageSize: query.pageSize };
}

/** A word may name one skill only: refused when another skill already has it as name or alias. */
async function assertFree(tx: Tx, words: string[], exceptId: string | null) {
  const keys = [...new Set(words.map((w) => termKey(plain(w))))];
  if (!keys.length) return;
  let query = tx
    .selectFrom('skills')
    .select(['id', 'canonical_name'])
    .where(sql<boolean>`(lower(canonical_name) = any(${keys}::text[]) or exists (select 1 from unnest(aliases) a where lower(ltrim(a, '~')) = any(${keys}::text[])))`);
  if (exceptId) query = query.where('id', '<>', exceptId);
  const taken = await query.executeTakeFirst();
  if (taken) throw errors.conflict(`${taken.canonical_name} already uses one of those names. A word can point to one skill only.`);
}

const dedupe = (words: string[]) => {
  const seen = new Set<string>();
  return words.filter((w) => {
    const key = termKey(w);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

async function skillById(tx: Tx, id: string) {
  const row = await tx.selectFrom('skills').select(['id', 'canonical_name', 'aliases', 'category_id', 'parent', 'updated_at', 'updated_by', 'created_at']).where('id', '=', id).forUpdate().executeTakeFirst();
  if (!row) throw errors.notFound('skill');
  return row;
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function addSkill(db: Database, staff: Staff, input: z.output<typeof newSkillSchema>, meta: RequestMeta) {
  const aliases = dedupe(input.aliases).filter((a) => termKey(a) !== termKey(input.name));
  const row = await db.withUser(staffDb(staff), async (tx) => {
    await assertFree(tx, [input.name, ...aliases], null);
    if (input.categoryId) {
      const category = await tx.selectFrom('skill_categories').select('id').where('id', '=', input.categoryId).executeTakeFirst();
      if (!category) throw errors.validation({ categoryId: 'unknown' }, 'That category does not exist.');
    }
    const created = await tx
      .insertInto('skills')
      .values({ canonical_name: input.name, aliases, category_id: input.categoryId ?? null, parent: input.parent || null, updated_by: staff.identity.userId })
      .returning(['id', 'canonical_name', 'aliases', 'category_id', 'parent', 'updated_at', 'updated_by', 'created_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'skill.create', targetType: 'skill', targetId: created.id, after: { name: created.canonical_name, aliases, categoryId: created.category_id, parent: created.parent } }, meta);
    return created;
  });
  return (await toWire(db, [row]))[0]!;
}

async function writeAliases(db: Database, staff: Staff, id: string, change: (current: string[]) => string[], audit: { action: string; reason?: string }, meta: RequestMeta) {
  if (!isUuid(id)) throw errors.notFound('skill');
  const row = await db.withUser(staffDb(staff), async (tx) => {
    const before = await skillById(tx, id);
    const next = dedupe(change(before.aliases)).filter((a) => termKey(a) !== termKey(before.canonical_name));
    const added = next.filter((a) => !before.aliases.some((b) => termKey(plain(b)) === termKey(a)));
    await assertFree(tx, added, id);
    const after = await tx
      .updateTable('skills')
      .set({ aliases: next, updated_by: staff.identity.userId })
      .where('id', '=', id)
      .returning(['id', 'canonical_name', 'aliases', 'category_id', 'parent', 'updated_at', 'updated_by', 'created_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: audit.action, targetType: 'skill', targetId: id, before: { aliases: before.aliases }, after: { aliases: next }, ...(audit.reason ? { reason: audit.reason } : {}) }, meta);
    return after;
  });
  return (await toWire(db, [row]))[0]!;
}

/** Replaces a skill's aliases (the editor's alias pills). */
export const setAliases = (db: Database, staff: Staff, id: string, aliases: string[], meta: RequestMeta) =>
  writeAliases(db, staff, id, () => aliases, { action: 'skill.aliases' }, meta);

/** Maps a term people typed onto a skill: it becomes one of the skill's aliases. */
export const mapTerm = (db: Database, staff: Staff, id: string, term: string, meta: RequestMeta) =>
  writeAliases(db, staff, id, (current) => (current.some((a) => termKey(plain(a)) === termKey(term)) ? current : [...current, term.trim()]), { action: 'skill.map_term', reason: term.trim().slice(0, 120) }, meta);

/**
 * Merge keeps the term as an alias of the suggested skill; dismiss remembers the decision, so the
 * suggestion stays gone. The suggestion is recomputed here, never trusted from the client.
 */
export async function resolveMerge(db: Database, staff: Staff, id: string, decision: 'merge' | 'dismiss', meta: RequestMeta) {
  const { merges } = await suggestions(db, staff);
  const suggestion = merges.find((m) => m.id === id);
  if (!suggestion) throw errors.notFound('merge suggestion');
  if (decision === 'merge') {
    await mapTerm(db, staff, suggestion.targetId, suggestion.alias, meta);
    return;
  }
  await db.withUser(staffDb(staff), async (tx) => {
    await tx
      .insertInto('skill_merge_dismissals')
      .values({ term_key: id.slice('merge:'.length), skill_id: suggestion.targetId, dismissed_by: staff.identity.userId })
      .onConflict((oc) => oc.column('term_key').doNothing())
      .execute();
    await writeAudit(tx, staff, { action: 'skill.merge_dismiss', targetType: 'skill', targetId: suggestion.targetId, reason: suggestion.alias.slice(0, 120) }, meta);
  });
}

const categoryId = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function addCategory(db: Database, staff: Staff, input: { name: string }, meta: RequestMeta) {
  const label = input.name.trim();
  const id = categoryId(label);
  if (!id) throw errors.validation({ name: 'empty' }, 'Give the category a name with letters or digits.');
  return db.withUser(staffDb(staff), async (tx) => {
    const clash = await tx.selectFrom('skill_categories').select('id').where((eb) => eb.or([eb('id', '=', id), eb(sql`lower(name)`, '=', label.toLowerCase())])).executeTakeFirst();
    if (clash) throw errors.conflict('A category with that name already exists.');
    const created = await tx.insertInto('skill_categories').values({ id, name: label, created_by: staff.identity.userId }).returning(['id', 'name']).executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'skill.category_create', targetType: 'skill_category', targetId: id, after: { name: label } }, meta);
    return { ...created, count: 0 };
  });
}
