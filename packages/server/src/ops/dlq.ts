import { createHash } from 'node:crypto';

import { sql } from 'kysely';

import type { Database } from '../db/database';
import { enqueue } from '../outbox/outbox';
import { lockGeneration } from '../pipeline/runner';
import { dlqOf, generationGroup, type QueueName } from '../queue/envelope';
import type { QueuePort, Received } from '../queue/port';

/**
 * Dead-letter tooling (ImBackendImplementationPlan P6-05, extended in P13-05; runbook
 * `aws/runbooks/dlq-replay.md`).
 *
 * - **inspect** lists what is in a queue's DLQ without consuming it: each message's type, its ids,
 *   how often it was received and when it was first sent. Envelope payloads hold ids only, never
 *   personal data, and a message that does not parse shows its size, not its body.
 * - **replay** is a dry run unless `apply` is set. A generation is reset to queued (its checkpoint
 *   kept) and announced again through the outbox, so it resumes from its first incomplete stage
 *   exactly as a user's retry does; a finished or deleted one is dropped from the DLQ. Every other
 *   message re-checks its own row's state, so it is sent back as it was. Unparseable bodies stay
 *   for a person unless `dropPoison` is set. Fix the cause first: a replayed poison message
 *   dead-letters again.
 */

export interface DlqEntry {
  type: string;
  ids: Record<string, string>;
  receiveCount: number;
  sentAt: string;
  /** A short digest of the FIFO group, so entries of one user line up without naming them. */
  group: string;
}

const PEEK_SECONDS = 30;
const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 10);

function summarize(m: Received): DlqEntry {
  const ids: Record<string, string> = {};
  for (const [k, v] of Object.entries((m.envelope?.payload ?? {}) as Record<string, unknown>)) if (typeof v === 'string' && v.length <= 80) ids[k] = v;
  return { type: m.envelope?.type ?? `unparseable (${m.raw.length} bytes)`, ids, receiveCount: m.receiveCount, sentAt: new Date(m.sentAt).toISOString(), group: digest(m.groupId) };
}

async function drain(port: QueuePort, queue: QueueName, max: number): Promise<Received[]> {
  const out: Received[] = [];
  while (out.length < max) {
    const batch = await port.receive(dlqOf(queue), { max: Math.min(10, max - out.length), waitSeconds: 1, visibilitySeconds: PEEK_SECONDS });
    if (batch.length === 0) break;
    out.push(...batch);
  }
  return out;
}

/** Lists up to `max` dead letters and puts them straight back (visibility 0). */
export async function inspectDlq(port: QueuePort, queue: QueueName, max = 100): Promise<DlqEntry[]> {
  const messages = await drain(port, queue, max);
  for (const m of messages) await port.setVisibility(m, 0);
  return messages.map(summarize);
}

export interface ReplayOptions {
  /** Without it nothing changes; the result says what would happen. */
  apply?: boolean;
  /** Only messages of this envelope type; the rest stay. */
  type?: string;
  max?: number;
  /** Delete bodies that do not parse (only with `apply`). */
  dropPoison?: boolean;
  /** Needed to replay `generation.run` messages. */
  db?: Database;
}

export interface ReplayResult {
  applied: boolean;
  replayed: number;
  /** generation.run messages whose run had finished or was deleted: removed, not replayed. */
  finished: number;
  skipped: number;
  unparseable: number;
  entries: DlqEntry[];
}

/** Resets a dead-lettered generation to queued and re-announces it; false when it is done or gone. */
async function requeueGeneration(db: Database, queue: QueueName, m: Received): Promise<boolean> {
  const envelope = m.envelope;
  if (envelope?.type !== 'generation.run') return false;
  const { generationId, userId } = envelope.payload;
  return db.withUser({ userId, role: 'user' }, async (tx) => {
    const row = await lockGeneration(tx, generationId);
    if (!row || row.status === 'ready') return false;
    await tx
      .updateTable('generations')
      .set({ status: 'queued', finished_at: null, error_code: null, error_message: null, cancel_requested_at: null, current_stage: null, started_at: sql`now()` })
      .where('id', '=', row.id)
      .execute();
    await enqueue(tx, { queue, groupId: generationGroup(userId, generationId), type: 'generation.run', payload: envelope.payload, correlationId: `replay:${envelope.id}` });
    return true;
  });
}

/** Sends dead letters (optionally of one type) back to work. */
export async function replayDlq(port: QueuePort, queue: QueueName, options: ReplayOptions = {}): Promise<ReplayResult> {
  const apply = options.apply ?? false;
  const messages = await drain(port, queue, options.max ?? 100);
  const result: ReplayResult = { applied: apply, replayed: 0, finished: 0, skipped: 0, unparseable: 0, entries: [] };
  for (const m of messages) {
    const envelope = m.envelope;
    if (!envelope) {
      result.unparseable++;
      if (apply && options.dropPoison) await port.ack(m);
      else await port.setVisibility(m, 0); // left for a person to look at; never replayed blind
      continue;
    }
    if (options.type && envelope.type !== options.type) {
      result.skipped++;
      await port.setVisibility(m, 0);
      continue;
    }
    result.entries.push(summarize(m));
    if (!apply) {
      await port.setVisibility(m, 0);
      continue;
    }
    if (envelope.type === 'generation.run') {
      if (!options.db) throw new Error('replaying generation.run needs the database');
      if (await requeueGeneration(options.db, queue, m)) result.replayed++;
      else result.finished++;
    } else {
      // A fresh deduplication id: the original's is inside SQS's window if it failed recently.
      const group = m.groupId || (envelope.type === 'maintenance.run' ? envelope.payload.job : envelope.id);
      await port.send(queue, envelope, { groupId: group, dedupId: `${envelope.id}-replay-${Date.now()}` });
      result.replayed++;
    }
    await port.ack(m);
  }
  return result;
}
