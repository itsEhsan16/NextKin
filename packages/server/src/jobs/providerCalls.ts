import { sql } from 'kysely';

import type { Database } from '../db/database';

/**
 * Each job provider's calls and failures per UTC day (migration 0054), counted where the search
 * fans out. The admin portal reads them for a provider's share of today's traffic, its calls
 * against the daily ceiling and its error rate. Aggregate only: no query, user or listing is kept.
 * A count that can't be written is dropped: it must never fail the search it describes.
 */
export async function countProviderCall(db: Database, provider: string, failed: boolean): Promise<void> {
  try {
    await db.withSystem('jobs: count a provider call', (tx) =>
      tx
        .insertInto('job_provider_calls')
        .values({ day: sql<Date>`(now() at time zone 'utc')::date`, provider, calls: 1, errors: failed ? 1 : 0 })
        .onConflict((oc) =>
          oc.columns(['day', 'provider']).doUpdateSet({
            calls: sql<number>`app.job_provider_calls.calls + 1`,
            errors: sql<number>`app.job_provider_calls.errors + ${failed ? 1 : 0}`,
          }),
        )
        .execute(),
    );
  } catch {
    // Dropped: a lost count must not fail the search.
  }
}
