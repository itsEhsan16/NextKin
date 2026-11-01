import { sql } from 'kysely';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import type { MaintenanceJob } from '../queue/envelope';

/**
 * The local scheduler (ImBackendImplementationPlan P6-06; EventBridge Scheduler replaces it at
 * X-05). Every worker ticks it; each run is claimed by inserting `(job, window_start)` into
 * `scheduler_runs`, whose primary key lets exactly one insert succeed, and the maintenance message
 * goes out in the same transaction (outbox). Two workers therefore never schedule the same run,
 * and a worker that dies mid-tick schedules nothing half-way.
 */

export type Every = 'minute' | 'hour' | 'day' | 'week';

export const SCHEDULE: readonly { job: MaintenanceJob; every: Every }[] = [
  { job: 'generation_sweep', every: 'minute' },
  { job: 'push_send', every: 'minute' },
  { job: 'anonymous_upload_purge', every: 'hour' },
  { job: 'upload_orphan_sweep', every: 'hour' },
  { job: 'trash_purge', every: 'day' },
  { job: 'closing_alerts', every: 'day' },
  { job: 'application_follow_ups', every: 'day' },
  { job: 'interview_reminders', every: 'day' },
  { job: 'push_purge', every: 'day' },
  { job: 'weekly_digest', every: 'day' },
  { job: 'notification_purge', every: 'day' },
  { job: 'event_purge', every: 'day' },
  { job: 'jobs_cache_expiry', every: 'day' },
  { job: 'trending', every: 'day' },
  { job: 'outbox_cleanup', every: 'day' },
  { job: 'eval_nightly', every: 'day' },
  { job: 'kb_candidates', every: 'week' },
  { job: 'account_purge', every: 'day' },
  { job: 'audit_export', every: 'day' },
];

/** The start of the window `now` falls in, in UTC. Weeks start on Monday. */
export function windowStart(every: Every, now: Date): Date {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  if (every === 'minute') return d;
  d.setUTCMinutes(0);
  if (every === 'hour') return d;
  d.setUTCHours(0);
  if (every === 'day') return d;
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

export function createScheduler(deps: { db: Database; log: Logger; schedule?: typeof SCHEDULE; now?: () => Date }) {
  const schedule = deps.schedule ?? SCHEDULE;
  let timer: NodeJS.Timeout | null = null;

  async function tick(): Promise<MaintenanceJob[]> {
    const now = deps.now?.() ?? new Date();
    return deps.db.withSystem('scheduler: claim due runs', async (tx) => {
      const claimed: MaintenanceJob[] = [];
      for (const { job, every } of schedule) {
        const start = windowStart(every, now);
        const row = await tx
          .insertInto('scheduler_runs')
          .values({ job, window_start: start })
          .onConflict((oc) => oc.columns(['job', 'window_start']).doNothing())
          .returning('job')
          .executeTakeFirst();
        if (!row) continue;
        await enqueue(tx, { queue: 'maintenance', groupId: job, type: 'maintenance.run', payload: { job, windowStart: start.toISOString() }, correlationId: `sched:${job}:${start.toISOString()}` });
        claimed.push(job);
      }
      return claimed;
    });
  }

  return {
    tick,
    start(intervalMs = 15_000) {
      const run = () =>
        tick()
          .then((jobs) => jobs.length && deps.log.info({ event: 'scheduler.enqueued', jobs }, 'scheduled maintenance'))
          .catch((error: unknown) => deps.log.error({ event: 'scheduler.error', errorName: error instanceof Error ? error.name : typeof error }, 'scheduler tick failed'));
      void run();
      timer = setInterval(run, intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}

/** Old claims are only an audit trail; the daily cleanup keeps 30 days. */
export async function cleanupSchedulerRuns(db: Database): Promise<number> {
  const result = await db.withSystem('scheduler: delete old run claims', (tx) =>
    tx.deleteFrom('scheduler_runs').where('window_start', '<', sql<Date>`now() - interval '30 days'`).executeTakeFirst(),
  );
  return Number(result.numDeletedRows);
}
