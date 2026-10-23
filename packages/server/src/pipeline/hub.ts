import type Valkey from 'iovalkey';
import type { Logger } from '../observability/logger';
import { channelFor, type PublishedEvent } from './events';

/**
 * The per-process fan-out for generation events (ImBackendImplementationPlan P6-13). Every SSE
 * connection in a web process shares ONE Valkey subscriber connection; a channel `gen:<id>` is
 * subscribed while at least one stream watches it and dropped with the last. Connection counts
 * are exposed for the metric.
 */
export interface GenerationHub {
  watch(generationId: string, onEvent: (event: PublishedEvent) => void): () => void;
  readonly connections: number;
  /** False when the subscriber connection is down: streams fall back to polling the table. */
  readonly healthy: boolean;
  close(): Promise<void>;
}

export function createGenerationHub(valkey: Valkey, log: Logger): GenerationHub {
  const subscriber = valkey.duplicate({ maxRetriesPerRequest: null, enableOfflineQueue: true });
  const listeners = new Map<string, Set<(event: PublishedEvent) => void>>();
  let connections = 0;
  let healthy = true;

  subscriber.on('error', () => {
    healthy = false;
  });
  subscriber.on('ready', () => {
    healthy = true;
  });
  subscriber.on('message', (channel: string, message: string) => {
    const set = listeners.get(channel);
    if (!set) return;
    let event: PublishedEvent;
    try {
      event = JSON.parse(message) as PublishedEvent;
    } catch {
      return;
    }
    for (const listener of set) listener(event);
  });

  return {
    watch(generationId, onEvent) {
      const channel = channelFor(generationId);
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
        subscriber.subscribe(channel).catch((error: unknown) => {
          healthy = false;
          log.warn({ event: 'sse.subscribe_failed', errorName: error instanceof Error ? error.name : typeof error }, 'subscribe failed; streams poll');
        });
      }
      set.add(onEvent);
      connections++;
      return () => {
        connections--;
        set.delete(onEvent);
        if (set.size === 0) {
          listeners.delete(channel);
          subscriber.unsubscribe(channel).catch(() => {});
        }
      };
    },
    get connections() {
      return connections;
    },
    get healthy() {
      return healthy && subscriber.status === 'ready';
    },
    async close() {
      subscriber.disconnect();
    },
  };
}
