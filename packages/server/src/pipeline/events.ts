import type { Generation } from '@nextkin/shared/models/generation';
import type { GenerationEventName } from '@nextkin/shared/schemas/generation';
import type Valkey from 'iovalkey';
import type { Tx } from '../db/database';

/**
 * Generation events (ImBackendImplementationPlan P6-13). Each is appended to `generation_events` in
 * the same transaction as the change it describes — the replay log for Last-Event-ID — and
 * published on Valkey `gen:<id>` after that transaction commits, for the web processes holding an
 * SSE connection. A lost publish costs nothing: the stream replays from the table, and polling
 * reads the row.
 */

export interface PublishedEvent {
  id: string;
  event: GenerationEventName;
  data: Generation;
}

export interface EventPublisher {
  publish(generationId: string, event: PublishedEvent): Promise<void>;
}

export const channelFor = (generationId: string) => `gen:${generationId}`;

export async function appendEvent(tx: Tx, generationId: string, userId: string, event: GenerationEventName, stage: string | null, snapshot: Generation): Promise<PublishedEvent> {
  const row = await tx
    .insertInto('generation_events')
    .values({ generation_id: generationId, user_id: userId, event, stage, snapshot: JSON.stringify(snapshot) })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: String(row.id), event, data: snapshot };
}

export function createValkeyPublisher(valkey: Valkey): EventPublisher {
  return {
    async publish(generationId, event) {
      await valkey.publish(channelFor(generationId), JSON.stringify(event)).catch(() => 0);
    },
  };
}

export const nullPublisher: EventPublisher = { publish: async () => {} };
