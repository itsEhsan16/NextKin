import { jobClashes } from '@nextkin/shared/models/jobFit';
import { sql } from 'kysely';

import type { Database } from '../db/database';
import { jobIdOf } from '../jobs/ids';
import { matchContext, scoreMatch } from '../jobs/matchScore';
import { toClientJob } from '../jobs/toJob';
import { normalizedJobSchema, type NormalizedJob } from '../jobs/types';
import type { Logger } from '../observability/logger';
import { notify } from './notifications';
import { jobPreferences } from './profileRead';

/**
 * Job alerts: one batch a day, never more (NOTIF 04; owner, 2026-11-01). New listings that match
 * well and don't clash with the candidate's preferences. It refuses sample listings outright, so
 * nobody hears about an invented job: until real providers arrive (D-12) this finds nothing.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_DAYS = 30;
const MAX_LISTINGS = 500;
const MAX_PEOPLE = 5000;
const GOOD_BANDS: ReadonlySet<string> = new Set(['strong', 'good']);
const PUSH_RANK = 3;

/** Real listings only. A candidate's own link is theirs already, and a fixture is invented. */
const isRealListing = (job: NormalizedJob): boolean => job.provider === 'adzuna' || job.provider === 'jsearch';

async function freshListings(db: Database, now: Date): Promise<NormalizedJob[]> {
  const rows = await db.withSystem('job alerts: listings new today', (tx) =>
    tx
      .selectFrom('jobs_cache')
      .select('normalized')
      .where('fetched_at', '>=', new Date(now.getTime() - DAY_MS))
      .where('expires_at', '>', now)
      .limit(MAX_LISTINGS)
      .execute(),
  );
  return rows.flatMap((row) => {
    const parsed = normalizedJobSchema.safeParse(row.normalized);
    if (!parsed.success || !isRealListing(parsed.data)) return [];
    // Fetching a listing again doesn't make it new.
    return new Date(parsed.data.postedAt).getTime() >= now.getTime() - DAY_MS ? [parsed.data] : [];
  });
}

/** People still looking: on a phone that said yes, or active in the last month. */
async function peopleLooking(db: Database, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - ACTIVE_DAYS * DAY_MS);
  const rows = await db.withSystem('job alerts: who is still looking', (tx) =>
    tx
      .selectFrom('activity')
      .select('user_id')
      .where('created_at', '>=', since)
      .union(tx.selectFrom('push_devices').select('user_id'))
      .limit(MAX_PEOPLE)
      .execute(),
  );
  return rows.map((row) => row.user_id);
}

const today = (now: Date): string => now.toISOString().slice(0, 10);

export async function runMatchAlerts(db: Database, log: Logger, now = new Date()): Promise<number> {
  const listings = await freshListings(db, now);
  if (listings.length === 0) return 0;
  const people = await peopleLooking(db, now);
  if (people.length === MAX_PEOPLE) log.warn({ event: 'job_alerts.capped', people: people.length }, 'job alerts read the people cap');

  let filed = 0;
  for (const userId of people) {
    await db.withUser({ userId, role: 'user' }, async (tx) => {
      const ctx = await matchContext(tx, userId, now);
      if (!ctx.hasProfile) return;
      const profile = await tx.selectFrom('profiles').select('preferences').where('user_id', '=', userId).executeTakeFirst();
      const prefs = jobPreferences(profile?.preferences);
      const known = new Set(
        [
          ...(await tx.selectFrom('saved_jobs').select(sql<string>`app.job_id_of(apply_url_hash)`.as('job_id')).where('user_id', '=', userId).execute()),
          ...(await tx.selectFrom('applications').select('job_id').where('user_id', '=', userId).execute()),
        ].map((row) => row.job_id),
      );
      const scored = listings.flatMap((listing) => {
        if (known.has(jobIdOf(listing.applyUrlHash))) return [];
        const match = scoreMatch(listing, ctx);
        return match?.matchBand && GOOD_BANDS.has(match.matchBand) ? [{ listing, sortKey: match.sortKey }] : [];
      });
      const fitting = scored.filter(({ listing }) => jobClashes(toClientJob(listing, 0), prefs).length === 0).sort((a, b) => b.sortKey - a.sortKey);
      const best = fitting[0]?.listing;
      if (!best) return;
      const count = fitting.length;
      const left = scored.length - count;
      await notify(tx, userId, {
        category: 'matches',
        body: `**${count === 1 ? '1 new match' : `${count} new matches`}** today`,
        description: `Best: ${best.title} at ${best.company}.${left > 0 ? ` ${left} left out for not fitting your preferences.` : ''}`,
        deepLink: '/jobs',
        visual: { kind: 'sparkle' },
        dedupeKey: `matches:${today(now)}`,
        pushRank: PUSH_RANK,
      });
      filed++;
    });
  }
  return filed;
}
