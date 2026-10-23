import { sql } from 'kysely';
import type { Database, Tx } from '../db/database';
import type { Logger } from '../observability/logger';
import { envelopeSchema, type Envelope, type MessageType, type PayloadOf, type QueueName } from '../queue/envelope';
import type { QueuePort } from '../queue/port';

/**
 * The transactional outbox (ImBackendImplementationPlan P6-02; replaces R-12's enqueue-after-commit
 * and re-drive sweeper). A business write and the message announcing it commit in ONE transaction,
 * so there is never a committed generation without its message, or a message for a write that
 * rolled back. A relay publishes the rows afterwards.
 *
 * Delivery is at least once: a relay that dies between publishing and marking the row publishes it
 * again. The row id is the SQS deduplication id, so a repeat inside SQS's 5-minute window is dropped,
 * and every consumer is idempotent for anything later.
 */

export interface OutboxMessage<T extends MessageType> {
  queue: QueueName;
  groupId: string;
  type: T;
  payload: PayloadOf<T>;
  correlationId?: string | null;
}

/** Adds a message to the caller's transaction. Runs as the app role (the outbox allows INSERT only). */
export async function enqueue<T extends MessageType>(tx: Tx, message: OutboxMessage<T>): Promise<void> {
  await tx
    .insertInto('outbox')
    .values({
      queue: message.queue,
      message_group_id: message.groupId,
      payload: JSON.stringify({ type: message.type, schemaVersion: 1, payload: message.payload }),
      correlation_id: message.correlationId ?? null,
    })
    .execute();
}

const RELAY_LOCK = 7_310_001; // pg advisory lock key: one relay leader at a time
const BATCH = 50;
const MAX_BACKOFF_SECONDS = 300;

export interface RelayResult {
  published: number;
  failed: number;
  /** False when another relay holds the leader lock; this one did nothing. */
  leader: boolean;
}

export interface OutboxRelay {
  /** Publishes one batch of pending rows. Safe to call from several processes at once. */
  tick(): Promise<RelayResult>;
  /** Polls until stopped: quickly while there is work, every second when idle. */
  start(): void;
  stop(): Promise<void>;
}

export function createOutboxRelay(deps: { db: Database; queue: QueuePort; log: Logger; idleMs?: number }): OutboxRelay {
  const { db, queue, log } = deps;
  let running = false;
  let loop: Promise<void> | null = null;

  async function tick(): Promise<RelayResult> {
    return db.withSystem('outbox: publish pending messages', async (tx) => {
      const lock = await sql<{ ok: boolean }>`select pg_try_advisory_xact_lock(${RELAY_LOCK}) as ok`.execute(tx);
      if (!lock.rows[0]?.ok) return { published: 0, failed: 0, leader: false };

      const rows = await tx
        .selectFrom('outbox')
        .select(['id', 'queue', 'message_group_id', 'payload', 'correlation_id', 'attempts'])
        .where('published_at', 'is', null)
        .where((eb) => eb.or([eb('next_attempt_at', 'is', null), eb('next_attempt_at', '<=', sql<Date>`now()`)]))
        .orderBy('id')
        .limit(BATCH)
        .forUpdate()
        .skipLocked()
        .execute();

      let published = 0;
      let failed = 0;
      for (const row of rows) {
        const stored = row.payload as { type: string; schemaVersion: number; payload: unknown };
        try {
          const envelope: Envelope = envelopeSchema.parse({ ...stored, id: String(row.id), correlationId: row.correlation_id });
          await queue.send(row.queue as QueueName, envelope, { groupId: row.message_group_id, dedupId: String(row.id) });
          await tx.updateTable('outbox').set({ published_at: sql`now()`, last_error: null }).where('id', '=', row.id).execute();
          published++;
        } catch (error) {
          failed++;
          // Capped exponential backoff with full jitter.
          const ceiling = Math.min(MAX_BACKOFF_SECONDS, 2 ** Math.min(row.attempts, 8));
          const wait = Math.ceil(Math.random() * ceiling);
          const reason = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 500) : 'unknown';
          await tx
            .updateTable('outbox')
            .set({ attempts: row.attempts + 1, last_error: reason, next_attempt_at: sql`now() + make_interval(secs => ${wait})` })
            .where('id', '=', row.id)
            .execute();
          log.warn({ event: 'outbox.publish_failed', outboxId: String(row.id), attempts: row.attempts + 1, retryInSeconds: wait }, 'outbox publish failed');
        }
      }
      return { published, failed, leader: true };
    });
  }

  return {
    tick,
    start() {
      if (running) return;
      running = true;
      loop = (async () => {
        while (running) {
          let busy = false;
          try {
            const result = await tick();
            busy = result.published > 0;
          } catch (error) {
            log.error({ event: 'outbox.relay_error', errorName: error instanceof Error ? error.name : typeof error }, 'outbox relay error');
          }
          if (running) await new Promise((resolve) => setTimeout(resolve, busy ? 50 : (deps.idleMs ?? 500)));
        }
      })();
    },
    async stop() {
      running = false;
      await loop;
    },
  };
}

/** Deletes published rows older than `days` (the daily outbox_cleanup job). */
export async function cleanupOutbox(db: Database, days = 7): Promise<number> {
  const result = await db.withSystem('outbox: delete published rows past retention', (tx) =>
    tx
      .deleteFrom('outbox')
      .where('published_at', '<', sql<Date>`now() - make_interval(days => ${days})`)
      .executeTakeFirst(),
  );
  return Number(result.numDeletedRows);
}
