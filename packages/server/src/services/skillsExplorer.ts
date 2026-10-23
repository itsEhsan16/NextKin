import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { sql } from 'kysely';

import type { Database } from '../db/database';
import { errors } from '../http/errors';

/**
 * The Skills Explorer's backend (ImBackendImplementationPlan P11-07; V2 §7.14). Pages wait for
 * their artboards and for curated entries (owner, 2026-10-12), so this is the read API, the
 * trending job and the KB import a curator will review in P12.
 *
 * - **Published only.** Every public read runs as the anonymous app role, whose row-level security
 *   shows only `review_status = 'published'` technologies; anything else is a 404.
 * - **Trending from anonymous aggregates.** Distinct users who added a published technology to
 *   their profile in the window, kept only at or above the threshold; no user id leaves the job.
 * - **The import is unpublished.** The engines' starter KB becomes `llm_seeded` rows (the system
 *   role may insert nothing else), so the Explorer shows none of it until a curator publishes it.
 */

export const TREND_WINDOW_DAYS = 30;
/** Below this many distinct users a technology is not shown as trending: a small count could point at someone. */
export const TREND_MIN_USERS = 10;
const TREND_LIMIT = 20;
const PAGE = 50;

export interface PublicSkill {
  slug: string;
  name: string;
  category: string;
  aliases: string[];
  releaseYear: number | null;
  safeUsageYear: number | null;
  enterpriseAdoptionYear: number | null;
  latestVersion: string | null;
  status: string;
  sourceCitation: string | null;
  updatedAt: string;
}

const COLUMNS = ['slug', 'name', 'category', 'aliases', 'release_year', 'safe_usage_year', 'enterprise_adoption_year', 'latest_version', 'status', 'source_citation', 'updated_at'] as const;

type Row = { slug: string; name: string; category: string; aliases: string[]; release_year: number | null; safe_usage_year: number | null; enterprise_adoption_year: number | null; latest_version: string | null; status: string; source_citation: string | null; updated_at: Date | string };

const toSkill = (r: Row): PublicSkill => ({
  slug: r.slug,
  name: r.name,
  category: r.category,
  aliases: r.aliases,
  releaseYear: r.release_year,
  safeUsageYear: r.safe_usage_year,
  enterpriseAdoptionYear: r.enterprise_adoption_year,
  latestVersion: r.latest_version,
  status: r.status,
  sourceCitation: r.source_citation,
  updatedAt: new Date(r.updated_at).toISOString(),
});

export async function listSkills(db: Database, filters: { category?: string; q?: string; offset?: number }): Promise<{ data: PublicSkill[]; nextOffset: number | null }> {
  const offset = filters.offset ?? 0;
  const rows = await db.withAnonymous((tx) => {
    let query = tx.selectFrom('technologies').select([...COLUMNS]).where('review_status', '=', 'published');
    if (filters.category) query = query.where('category', '=', filters.category);
    if (filters.q) query = query.where(sql<boolean>`lower(name) like ${`%${filters.q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`}`);
    return query.orderBy('name').offset(offset).limit(PAGE + 1).execute();
  });
  return { data: rows.slice(0, PAGE).map(toSkill), nextOffset: rows.length > PAGE ? offset + PAGE : null };
}

export async function getSkill(db: Database, slug: string): Promise<PublicSkill & { related: { slug: string; name: string; kind: string }[] }> {
  return db.withAnonymous(async (tx) => {
    const row = await tx.selectFrom('technologies').select(['id', ...COLUMNS]).where('slug', '=', slug).where('review_status', '=', 'published').executeTakeFirst();
    if (!row) throw errors.notFound('skill');
    // Related entries are shown only when they are published themselves.
    const related = await tx
      .selectFrom('technology_relations as r')
      .innerJoin('technologies as t', 't.id', 'r.to_technology_id')
      .select(['t.slug', 't.name', 'r.kind'])
      .where('r.from_technology_id', '=', row.id)
      .where('t.review_status', '=', 'published')
      .orderBy('t.name')
      .limit(20)
      .execute();
    return { ...toSkill(row), related };
  });
}

export async function trendingSkills(db: Database): Promise<{ slug: string; name: string; category: string; rank: number; computedAt: string }[]> {
  const rows = await db.withAnonymous((tx) =>
    tx
      .selectFrom('skill_trends as s')
      .innerJoin('technologies as t', 't.id', 's.technology_id')
      .select(['t.slug', 't.name', 't.category', 's.rank', 's.computed_at'])
      .where('t.review_status', '=', 'published')
      .orderBy('s.rank')
      .limit(TREND_LIMIT)
      .execute(),
  );
  // The count itself is not published: the rank says what the list needs to.
  return rows.map((r) => ({ slug: r.slug, name: r.name, category: r.category, rank: r.rank, computedAt: new Date(r.computed_at).toISOString() }));
}

/** Every slug the sitemap lists: published entries only. */
export async function publishedSlugs(db: Database): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await db.withAnonymous((tx) => tx.selectFrom('technologies').select(['slug', 'updated_at']).where('review_status', '=', 'published').orderBy('slug').limit(50_000).execute());
  return rows.map((r) => ({ slug: r.slug, updatedAt: new Date(r.updated_at).toISOString() }));
}

/** The daily job: replaces the trend rows with this window's aggregates, at or above the threshold. */
export async function computeSkillTrends(db: Database, options: { minUsers?: number; windowDays?: number } = {}): Promise<number> {
  const minUsers = options.minUsers ?? TREND_MIN_USERS;
  const windowDays = options.windowDays ?? TREND_WINDOW_DAYS;
  return db.withSystem('skills: compute anonymous trending aggregates', async (tx) => {
    const counts = await sql<{ technology_id: string; users: number }>`
      select t.id as technology_id, count(distinct ps.user_id)::int as users
      from app.technologies t
      join app.profile_skills ps
        on lower(ps.raw_name) = lower(t.name) or lower(ps.raw_name) = any (select lower(a) from unnest(t.aliases) a)
      where t.review_status = 'published'
        and ps.created_at >= now() - make_interval(days => ${windowDays})
      group by t.id
      having count(distinct ps.user_id) >= ${minUsers}
      order by users desc, t.id
      limit ${TREND_LIMIT}`.execute(tx);
    await tx.deleteFrom('skill_trends').execute();
    for (const [index, row] of counts.rows.entries()) {
      await tx.insertInto('skill_trends').values({ technology_id: row.technology_id, rank: index + 1, user_count: row.users, window_days: windowDays }).execute();
    }
    return counts.rows.length;
  });
}

const slugOf = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The engines' starter KB as unpublished rows for P12's curators: name, category and aliases from
 * the taxonomy, the three years, and `related` links. An existing row (curated or not) is never
 * touched. Idempotent.
 */
export async function importKbForReview(db: Database): Promise<{ inserted: number; related: number }> {
  return db.withSystem('kb: import the starter KB for curator review (unpublished)', async (tx) => {
    let inserted = 0;
    for (const entry of KB.entries) {
      const def = TAXONOMY.skills.find((s) => s.id === entry.skillId);
      if (!def) continue;
      const row = await tx
        .insertInto('technologies')
        .values({
          name: def.name,
          slug: slugOf(def.id),
          category: def.category,
          aliases: def.aliases.map((a) => a.replace(/^~/, '')),
          release_year: entry.releaseYear,
          safe_usage_year: entry.safeUsageYear,
          enterprise_adoption_year: entry.enterpriseAdoptionYear,
          review_status: 'llm_seeded',
          dataset_version: 1,
        })
        .onConflict((oc) => oc.column('slug').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (row) inserted++;
    }
    const ids = new Map((await tx.selectFrom('technologies').select(['id', 'slug', 'review_status']).execute()).map((r) => [r.slug, r]));
    let related = 0;
    for (const entry of KB.entries) {
      const from = ids.get(slugOf(entry.skillId));
      if (!from || from.review_status !== 'llm_seeded') continue;
      for (const other of entry.related ?? []) {
        const to = ids.get(slugOf(other));
        if (!to || to.review_status !== 'llm_seeded' || to.id === from.id) continue;
        const done = await tx
          .insertInto('technology_relations')
          .values({ from_technology_id: from.id, to_technology_id: to.id, kind: 'related' })
          .onConflict((oc) => oc.doNothing())
          .returning('kind')
          .executeTakeFirst();
        if (done) related++;
      }
    }
    return { inserted, related };
  });
}
