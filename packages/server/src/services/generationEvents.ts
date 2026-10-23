import type { Generation } from '@nextkin/shared/models/generation';

import type { Database, Identity } from '../db/database';
import type { PublishedEvent } from '../pipeline/events';

/** A generation's event log, as the SSE route replays it (spec §11; P6-14). */

/** For the SSE replay: events after the given id, oldest first. */
export async function eventsAfter(db: Database, identity: Identity, generationId: string, afterId: number): Promise<PublishedEvent[]> {
  const rows = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('generation_events')
      .select(['id', 'event', 'snapshot'])
      .where('generation_id', '=', generationId)
      .where('id', '>', String(afterId))
      .orderBy('id')
      .limit(500)
      .execute(),
  );
  return rows.map((row) => ({ id: String(row.id), event: row.event as PublishedEvent['event'], data: row.snapshot as Generation }));
}

/**
 * Where a fresh stream starts: after the last terminal event, when the run is live again (a retry).
 * Without this a client connecting to a retried run would replay the old `failed` and stop.
 */
export async function lastTerminalEventId(db: Database, identity: Identity, generationId: string): Promise<number> {
  const row = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('generation_events')
      .select(({ fn }) => fn.max('id').as('id'))
      .where('generation_id', '=', generationId)
      .where('event', 'in', ['failed', 'completed'])
      .executeTakeFirst(),
  );
  return Number(row?.id ?? 0);
}
