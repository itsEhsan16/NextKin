import { randomUUID } from 'node:crypto';
import { dlqOf, envelopeSchema, type QueueName } from './envelope';
import type { AnyQueue, QueuePort, Received } from './port';

/**
 * An in-memory FIFO queue with SQS's semantics, for unit tests (P6-01): one in-flight message per
 * group, a visibility timeout, deduplication by id within a window, and redrive to the DLQ after
 * `maxReceiveCount` receives. The SQS adapter is proved against ElasticMQ in integration.
 */
interface Stored {
  id: string;
  body: string;
  groupId: string;
  dedupId: string;
  sentAt: number;
  receiveCount: number;
  hiddenUntil: number;
  receipt: string | null;
}

export function createMemoryQueue(options: { maxReceiveCount?: number; now?: () => number } = {}): QueuePort & { contents(queue: AnyQueue): Stored[] } {
  const maxReceiveCount = options.maxReceiveCount ?? 5;
  const now = options.now ?? Date.now;
  const queues = new Map<AnyQueue, Stored[]>();
  const seen = new Map<string, number>();
  const list = (queue: AnyQueue) => {
    let items = queues.get(queue);
    if (!items) queues.set(queue, (items = []));
    return items;
  };
  const isDlq = (queue: AnyQueue) => queue.endsWith('-dlq');

  return {
    contents: (queue) => list(queue),

    async send(queue, envelope, { groupId, dedupId }) {
      envelopeSchema.parse(envelope);
      const key = `${queue}:${dedupId}`;
      const at = seen.get(key);
      if (at !== undefined && now() - at < 5 * 60_000) return; // SQS's 5-minute dedup window
      seen.set(key, now());
      list(queue).push({ id: randomUUID(), body: JSON.stringify(envelope), groupId, dedupId, sentAt: now(), receiveCount: 0, hiddenUntil: 0, receipt: null });
    },

    async receive(queue, { max, visibilitySeconds }) {
      const items = list(queue);
      const busyGroups = new Set(items.filter((m) => m.hiddenUntil > now()).map((m) => m.groupId));
      const out: Received[] = [];
      for (const message of [...items]) {
        if (out.length >= max) break;
        if (message.hiddenUntil > now() || busyGroups.has(message.groupId)) continue;
        if (!isDlq(queue) && message.receiveCount >= maxReceiveCount) {
          items.splice(items.indexOf(message), 1);
          list(dlqOf(queue as QueueName)).push({ ...message, receiveCount: 0, hiddenUntil: 0, receipt: null });
          continue;
        }
        message.receiveCount += 1;
        message.hiddenUntil = now() + visibilitySeconds * 1000;
        message.receipt = randomUUID();
        busyGroups.add(message.groupId);
        let envelope: Received['envelope'] = null;
        try {
          const parsed = envelopeSchema.safeParse(JSON.parse(message.body));
          envelope = parsed.success ? parsed.data : null;
        } catch {
          envelope = null;
        }
        out.push({ queue, receiptHandle: message.receipt, envelope, raw: message.body, receiveCount: message.receiveCount, groupId: message.groupId, sentAt: message.sentAt });
      }
      return out;
    },

    async ack(received) {
      const items = list(received.queue);
      const index = items.findIndex((m) => m.receipt === received.receiptHandle);
      if (index >= 0) items.splice(index, 1);
    },

    async setVisibility(received, seconds) {
      const message = list(received.queue).find((m) => m.receipt === received.receiptHandle);
      if (message) message.hiddenUntil = now() + seconds * 1000;
    },

    async stats(queue) {
      const items = list(queue);
      const visible = items.filter((m) => m.hiddenUntil <= now());
      const oldest = visible.reduce<number | null>((min, m) => (min === null || m.sentAt < min ? m.sentAt : min), null);
      return { visible: visible.length, inFlight: items.length - visible.length, oldestAgeSeconds: oldest === null ? null : Math.floor((now() - oldest) / 1000) };
    },

    async purge(queue) {
      list(queue).length = 0;
    },
  };
}
