import { sql } from 'kysely';

import type { Database } from '../../db/database';

/**
 * Week-4 retention (V2 §2.2): of the people who made a first resume within 72 hours of signing up,
 * the share who came back and did something that matters in their fourth week. It reads what people
 * did from the tables that record it, not usage events, so someone who switched "Share anonymized
 * data" off still counts. Aggregate only, as §7.17 asks: counts per signup week, nobody named.
 *
 * - **Activated:** a finished resume or Zero Resume within 72 hours of signing up.
 * - **Returned:** generated or scored, edited a resume themselves, or saved a job, 21 to 28 days
 *   after activating.
 * - **Complete:** every person in the week has had their full fourth week. Until then the rate can
 *   only rise, so it isn't a final number.
 *
 * Staff accounts don't count, and neither do accounts since deleted: their rows are gone.
 */

export const RETENTION_TARGET = 0.2;
const WEEKS_SHOWN = 16;

export interface RetentionCohort {
  /** The Monday of the signup week, as YYYY-MM-DD. */
  week: string;
  activated: number;
  returned: number;
  /** returned / activated; null when nobody in the week activated. */
  rate: number | null;
  complete: boolean;
}

interface Row {
  week: string;
  activated: string;
  returned: string;
  complete: boolean;
}

export async function weekFourRetention(db: Database, now = new Date()): Promise<RetentionCohort[]> {
  const since = new Date(now.getTime() - WEEKS_SHOWN * 7 * 24 * 60 * 60 * 1000);
  const rows = await db.withSystem('metrics: week-4 retention, aggregate only', async (tx) => {
    const result = await sql<Row>`
      WITH activated AS (
        SELECT u.id, u.created_at, min(g.finished_at) AS activated_at
        FROM app.users u
        JOIN app.generations g ON g.user_id = u.id
        WHERE u.role = 'user'
          AND u.created_at >= ${since}
          AND g.status = 'ready'
          AND g.kind IN ('resume', 'zero_resume')
          AND g.finished_at <= u.created_at + interval '72 hours'
        GROUP BY u.id, u.created_at
      ), actions AS (
        SELECT user_id, created_at AS at FROM app.generations
        UNION ALL
        SELECT user_id, created_at FROM app.resume_versions WHERE created_by = 'user'
        UNION ALL
        SELECT user_id, saved_at FROM app.saved_jobs
      )
      SELECT to_char(date_trunc('week', a.created_at), 'YYYY-MM-DD') AS week,
             count(*) AS activated,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM actions x
               WHERE x.user_id = a.id
                 AND x.at >= a.activated_at + interval '21 days'
                 AND x.at < a.activated_at + interval '28 days'
             )) AS returned,
             bool_and(a.activated_at + interval '28 days' <= ${now}) AS complete
      FROM activated a
      GROUP BY 1
      ORDER BY 1 DESC
    `.execute(tx);
    return result.rows;
  });
  return rows.map((row) => {
    const activated = Number(row.activated);
    const returned = Number(row.returned);
    return { week: row.week, activated, returned, rate: activated ? returned / activated : null, complete: row.complete };
  });
}
