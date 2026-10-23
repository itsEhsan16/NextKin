import { sql } from 'kysely';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';

/**
 * The per-call trace (ImBackendImplementationPlan P6-10): one `ai_calls` row per attempt, with the
 * provider, model, prompt version, tokens in and out, cache reads and writes, latency, cost and
 * outcome. Prompts and answers are never stored. A trace write that fails is logged and never fails
 * the call it describes.
 *
 * A developer call whose row could not be written still counts toward the D-23 cap: its cost is
 * held in this process for the rest of the UTC day and added to what the table holds. Before that
 * (toreview §108), a rejected row made the day's spend read as nothing and the cap never tripped.
 */
export interface TraceRow {
  subject_user_id: string | null;
  generation_id: string | null;
  stage: string;
  provider: string;
  endpoint: string;
  model: string;
  prompt_version_id: string | null;
  tag: 'product' | 'eval' | 'dev';
  correlation_id: string | null;
  developer: string | null;
  truncated: boolean;
  outcome: 'ok' | 'refusal' | 'invalid_output' | 'error' | 'capped';
  error_code?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cost_micros?: number;
  latency_ms?: number;
}

export interface AiTrace {
  record(row: TraceRow): Promise<void>;
  /** What the developer's live calls have cost today (UTC), for the D-23 cap. */
  developerSpendTodayMicros(developer: string): Promise<number>;
}

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

export function createDbTrace(db: Database, log: Logger, now: () => Date = () => new Date()): AiTrace {
  // Developer spend whose rows failed to write, per developer, for the current UTC day only.
  const unrecorded = new Map<string, { day: string; micros: number }>();
  const unrecordedToday = (developer: string) => {
    const held = unrecorded.get(developer);
    return held && held.day === utcDay(now()) ? held.micros : 0;
  };
  return {
    async record(row) {
      await db
        .withSystem('ai: record the call trace', (tx) => tx.insertInto('ai_calls').values({ ...row, error_code: row.error_code ?? null }).execute())
        .catch((error: unknown) => {
          if (row.tag === 'dev' && row.developer && row.cost_micros) {
            unrecorded.set(row.developer, { day: utcDay(now()), micros: unrecordedToday(row.developer) + row.cost_micros });
          }
          log.error({ event: 'ai.trace_failed', errorName: error instanceof Error ? error.name : typeof error, provider: row.provider, stage: row.stage }, 'ai trace write failed');
        });
    },
    async developerSpendTodayMicros(developer) {
      const row = await db.withSystem('ai: read the developer spend for the daily cap', (tx) =>
        tx
          .selectFrom('ai_calls')
          .select(sql<string>`coalesce(sum(cost_micros), 0)`.as('spent'))
          .where('tag', '=', 'dev')
          .where('developer', '=', developer)
          .where('created_at', '>=', sql<Date>`date_trunc('day', now() at time zone 'utc') at time zone 'utc'`)
          .executeTakeFirst(),
      );
      return Number(row?.spent ?? 0) + unrecordedToday(developer);
    },
  };
}

/** In-memory trace for unit tests. */
export function createMemoryTrace(): AiTrace & { rows: TraceRow[] } {
  const rows: TraceRow[] = [];
  return {
    rows,
    async record(row) {
      rows.push(row);
    },
    async developerSpendTodayMicros(developer) {
      return rows.filter((r) => r.tag === 'dev' && r.developer === developer).reduce((n, r) => n + (r.cost_micros ?? 0), 0);
    },
  };
}
