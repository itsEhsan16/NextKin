import { JOB_COMPARATORS, JOBS_PAGE_SIZE, matchesFilters, SAVED_JOB_COMPARATORS, similarJobs } from '@nextkin/shared/jobs/filters';
import type { Job, JobFilters, JobSort, SavedJobsSort } from '@nextkin/shared/models/job';
import { jobSchema } from '@nextkin/shared/schemas/job';
import type { Page } from '@nextkin/shared/repos/types';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { decodeCursor, encodeCursor } from '../http/cursor';
import { AppError, errors } from '../http/errors';
import { mergedListings, type AggregateDeps, type CachedListing } from '../jobs/aggregate';
import { matchContext, scoreMatch, type JobMatch } from '../jobs/matchScore';
import { snapshotOf, toClientJob, type UserDecoration } from '../jobs/toJob';
import { normalizedJobSchema, type NormalizedJob } from '../jobs/types';
import { planOf } from './plan';

/**
 * Jobs for the apps (ImBackendImplementationPlan P11-03…P11-05; V2 §7.13). Search, counts and
 * picks read the merged provider result; every listing is decorated per user (saved state, match)
 * on the way out. Saved jobs are the user's own rows: idempotent, capped at 10 open listings on
 * Free (an 11th answers PLAN_LOCKED), and a listing its source has closed is flagged, never deleted.
 */

export interface JobsDeps {
  db: Database;
  aggregate: AggregateDeps;
  cursorSecret: string;
}

interface Listed {
  normalized: NormalizedJob;
  rank: number;
}

const toListed = (l: CachedListing): Listed => ({ normalized: l.normalized, rank: l.rank });
const isOpen = (n: NormalizedJob, now: number) => !n.closingAt || new Date(n.closingAt).getTime() >= now;

/** Saved state and match for a set of listings, in one transaction as the user. */
async function decorate(tx: Tx, userId: string, listed: Listed[], extra: Pick<UserDecoration, 'isPick' | 'isTodaysPick'> = {}): Promise<{ job: Job; match: JobMatch | null }[]> {
  const ctx = await matchContext(tx, userId);
  const hashes = listed.map((l) => l.normalized.applyUrlHash);
  const saved = hashes.length
    ? await tx.selectFrom('saved_jobs').select(['apply_url_hash', 'saved_at', 'expired_at']).where('user_id', '=', userId).where('apply_url_hash', 'in', hashes).execute()
    : [];
  const savedBy = new Map(saved.map((s) => [s.apply_url_hash, s]));
  return listed.map((l) => {
    const s = savedBy.get(l.normalized.applyUrlHash);
    const match = scoreMatch(l.normalized, ctx);
    return { job: toClientJob(l.normalized, l.rank, { ...(s ? { saved: { savedAt: s.saved_at, unavailable: s.expired_at !== null } } : {}), match, ...extra }), match };
  });
}

const offsetOf = (cursor: string | undefined, secret: string) => (cursor ? Math.max(0, Number(decodeCursor(cursor, secret).k) || 0) : 0);

async function searched(deps: JobsDeps, filters: JobFilters) {
  const merged = await mergedListings(deps.aggregate, { ...(filters.query ? { query: filters.query } : {}), ...(filters.locations[0] ? { location: filters.locations[0] } : {}), page: 1 });
  const now = Date.now();
  return merged.listings.map(toListed).filter((l) => matchesFilters(toClientJob(l.normalized, l.rank), filters, now));
}

export async function searchJobs(deps: JobsDeps, identity: Identity, filters: JobFilters, sort: JobSort, cursor?: string): Promise<Page<Job>> {
  const matching = await searched(deps, filters);
  matching.sort((a, b) => JOB_COMPARATORS[sort](toClientJob(a.normalized, a.rank), toClientJob(b.normalized, b.rank)));
  const offset = offsetOf(cursor, deps.cursorSecret);
  const page = matching.slice(offset, offset + JOBS_PAGE_SIZE);
  const items = (await deps.db.withUser(identity, (tx) => decorate(tx, identity.userId, page))).map((d) => d.job);
  const end = offset + page.length;
  return { items, ...(end < matching.length ? { nextCursor: encodeCursor({ k: String(end), i: 'jobs' }, deps.cursorSecret) } : {}) };
}

export const countJobs = async (deps: JobsDeps, filters: JobFilters): Promise<number> => (await searched(deps, filters)).length;

async function openListings(deps: JobsDeps): Promise<Listed[]> {
  const now = Date.now();
  return (await mergedListings(deps.aggregate, { page: 1 })).listings.map(toListed).filter((l) => isOpen(l.normalized, now));
}

const bestFirst = (a: { job: Job; match: JobMatch | null }, b: { job: Job; match: JobMatch | null }) =>
  (b.match?.sortKey ?? -1) - (a.match?.sortKey ?? -1) || b.job.postedAt.localeCompare(a.job.postedAt);

/** Home's "Top Job Matches": the ten open listings that best match the profile. */
export async function listPicks(deps: JobsDeps, identity: Identity): Promise<Job[]> {
  const open = await openListings(deps);
  const decorated = await deps.db.withUser(identity, (tx) => decorate(tx, identity.userId, open, { isPick: true }));
  return decorated.filter((d) => (d.match?.sortKey ?? -1) >= 0).sort(bestFirst).slice(0, 10).map((d) => d.job);
}

/** The Jobs tab's carousel: the best matches posted in the last two days, else the freshest. */
export async function listTodaysPicks(deps: JobsDeps, identity: Identity): Promise<Job[]> {
  const open = await openListings(deps);
  const decorated = await deps.db.withUser(identity, (tx) => decorate(tx, identity.userId, open, { isTodaysPick: true }));
  const since = Date.now() - 48 * 3_600_000;
  const fresh = decorated.filter((d) => new Date(d.job.postedAt).getTime() >= since).sort(bestFirst);
  const picks = fresh.length > 0 ? fresh : [...decorated].sort((a, b) => b.job.postedAt.localeCompare(a.job.postedAt));
  return picks.slice(0, 3).map((d) => d.job);
}

/** A listing by id: the live cache first, then the user's saved copy; else gone. */
export async function findListing(tx: Tx, userId: string, id: string): Promise<{ normalized: NormalizedJob; cacheId: string | null } | null> {
  const live = await tx
    .selectFrom('jobs_cache')
    .select(['id', 'normalized'])
    .where((eb) => eb(sql`app.job_id_of(apply_url_hash)`, '=', id))
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  const parsedLive = live ? normalizedJobSchema.safeParse(live.normalized) : null;
  if (live && parsedLive?.success) return { normalized: parsedLive.data, cacheId: live.id };
  const saved = await tx
    .selectFrom('saved_jobs')
    .select(['snapshot'])
    .where('user_id', '=', userId)
    .where((eb) => eb(sql`app.job_id_of(apply_url_hash)`, '=', id))
    .executeTakeFirst();
  const parsedSaved = saved ? normalizedJobSchema.safeParse(saved.snapshot) : null;
  return parsedSaved?.success ? { normalized: parsedSaved.data, cacheId: null } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getJob(deps: JobsDeps, identity: Identity, id: string): Promise<Job> {
  if (!UUID.test(id)) throw errors.notFound('job');
  return deps.db.withUser(identity, async (tx) => {
    const found = await findListing(tx, identity.userId, id);
    if (found) {
      const [decorated] = await decorate(tx, identity.userId, [{ normalized: found.normalized, rank: 0 }]);
      return decorated!.job;
    }
    // A job only an application still holds: a description with no listing, or one since closed.
    const applied = await tx.selectFrom('applications').select('job').where('user_id', '=', identity.userId).where('job_id', '=', id).executeTakeFirst();
    if (!applied) throw errors.notFound('job');
    return jobSchema.parse(applied.job) as Job;
  });
}

/** "Similar jobs": same tags, another company, best match first (the mock's rule, shared). */
export async function listSimilar(deps: JobsDeps, identity: Identity, id: string, limit = 3): Promise<Job[]> {
  const target = await getJob(deps, identity, id);
  const candidates = (await mergedListings(deps.aggregate, { page: 1 })).listings.map(toListed);
  const decorated = await deps.db.withUser(identity, (tx) => decorate(tx, identity.userId, candidates));
  return similarJobs(target, decorated.map((d) => d.job), Math.min(10, Math.max(1, limit)));
}

/** Every open role at one employer the cache holds, newest first. */
export async function listByCompany(deps: JobsDeps, identity: Identity, company: string): Promise<Job[]> {
  return deps.db.withUser(identity, async (tx) => {
    const rows = await tx
      .selectFrom('jobs_cache')
      .select(['normalized'])
      .where(sql`lower(company)`, '=', company.trim().toLowerCase())
      .where('expires_at', '>', new Date())
      .limit(100)
      .execute();
    const listed = rows.map((r) => normalizedJobSchema.safeParse(r.normalized)).filter((p) => p.success).map((p, rank) => ({ normalized: p.data!, rank }));
    return (await decorate(tx, identity.userId, listed)).map((d) => d.job).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  });
}

/**
 * The user's saved jobs, each from its live listing when cached, else from the copy kept at save.
 * Refresh on view: a listing past its closing date is flagged `expired_at` and stays (P11-04).
 */
export async function listSaved(deps: JobsDeps, identity: Identity, sort: SavedJobsSort = 'recent'): Promise<Job[]> {
  return deps.db.withUser(identity, async (tx) => {
    const rows = await tx.selectFrom('saved_jobs').select(['id', 'apply_url_hash', 'snapshot', 'saved_at', 'expired_at']).where('user_id', '=', identity.userId).orderBy('saved_at', 'desc').limit(500).execute();
    if (rows.length === 0) return [];
    const live = await tx.selectFrom('jobs_cache').select(['apply_url_hash', 'normalized']).where('apply_url_hash', 'in', rows.map((r) => r.apply_url_hash)).where('expires_at', '>', new Date()).execute();
    const liveBy = new Map(live.map((l) => [l.apply_url_hash, l.normalized]));
    const ctx = await matchContext(tx, identity.userId);
    const now = Date.now();
    const jobs: Job[] = [];
    for (const [index, row] of rows.entries()) {
      const parsed = normalizedJobSchema.safeParse(liveBy.get(row.apply_url_hash) ?? row.snapshot);
      if (!parsed.success) continue;
      let expired = row.expired_at !== null;
      if (!expired && !isOpen(parsed.data, now)) {
        await tx.updateTable('saved_jobs').set({ expired_at: new Date() }).where('id', '=', row.id).execute();
        expired = true;
      }
      jobs.push(toClientJob(parsed.data, index, { saved: { savedAt: row.saved_at, unavailable: expired }, match: scoreMatch(parsed.data, ctx) }));
    }
    return jobs.sort(SAVED_JOB_COMPARATORS[sort]);
  });
}

/**
 * Saves or unsaves (P11-04). Idempotent on (user, listing). Saving is serialized per user with an
 * advisory lock, so two concurrent saves at 9 cannot both pass the cap; saves already above it stay.
 */
export async function setSaved(deps: JobsDeps, identity: Identity, id: string, saved: boolean): Promise<Job> {
  if (!UUID.test(id)) throw errors.notFound('job');
  return deps.db.withUser(identity, async (tx) => {
    const found = await findListing(tx, identity.userId, id);
    if (!found) throw errors.notFound('job');
    const hash = found.normalized.applyUrlHash;
    if (!saved) {
      await tx.deleteFrom('saved_jobs').where('user_id', '=', identity.userId).where('apply_url_hash', '=', hash).execute();
    } else {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`saved_jobs:${identity.userId}`}))`.execute(tx);
      const already = await tx.selectFrom('saved_jobs').select('id').where('user_id', '=', identity.userId).where('apply_url_hash', '=', hash).executeTakeFirst();
      if (!already) {
        const plan = await planOf(tx, identity.userId);
        if (plan.savedJobs !== null) {
          const open = await tx.selectFrom('saved_jobs').select((eb) => eb.fn.countAll<string>().as('n')).where('user_id', '=', identity.userId).where('expired_at', 'is', null).executeTakeFirstOrThrow();
          if (Number(open.n) >= plan.savedJobs) throw new AppError('PLAN_LOCKED', `Free saves up to ${plan.savedJobs} jobs. Upgrade to save more.`, { reason: 'saved_jobs', limit: plan.savedJobs });
        }
        await tx
          .insertInto('saved_jobs')
          .values({ user_id: identity.userId, apply_url_hash: hash, jobs_cache_id: found.cacheId, snapshot: JSON.stringify(snapshotOf(found.normalized)) })
          .onConflict((oc) => oc.columns(['user_id', 'apply_url_hash']).doNothing())
          .execute();
      }
    }
    const [decorated] = await decorate(tx, identity.userId, [{ normalized: found.normalized, rank: 0 }]);
    return decorated!.job;
  });
}

export async function setSavedNotes(deps: JobsDeps, identity: Identity, id: string, notes: string): Promise<void> {
  if (!UUID.test(id)) throw errors.notFound('job');
  const done = await deps.db.withUser(identity, (tx) =>
    tx
      .updateTable('saved_jobs')
      .set({ notes: notes.trim() || null })
      .where('user_id', '=', identity.userId)
      .where((eb) => eb(sql`app.job_id_of(apply_url_hash)`, '=', id))
      .returning('id')
      .executeTakeFirst(),
  );
  if (!done) throw errors.notFound('saved job');
}
