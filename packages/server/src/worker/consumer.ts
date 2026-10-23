import type { Logger } from '../observability/logger';
import type { AnyQueue, QueuePort, Received } from '../queue/port';

/**
 * A queue consumer (ImBackendImplementationPlan P6-03).
 *
 * - **Bounded concurrency** across its queues; `sources` are polled in order, so the priority queue
 *   is drained before the standard one.
 * - **Visibility heartbeat**: while a handler runs, the message's visibility is extended every third
 *   of the timeout, so a slow stage is never handed to a second worker.
 * - **Failure**: the message is not acknowledged and comes back after a capped, jittered backoff;
 *   after the queue's `maxReceiveCount` it dead-letters. A body that does not parse is poison: it
 *   is made visible again at once, so it reaches the DLQ in seconds instead of blocking its FIFO
 *   group for minutes.
 * - **Stop** (SIGTERM): polling stops, in-flight handlers get `graceMs` to finish, and whatever is
 *   still running is released (visibility 0) for another worker to resume from its checkpoint.
 */

export interface ConsumerOptions {
  name: string;
  queue: QueuePort;
  sources: AnyQueue[];
  concurrency: number;
  handler: (message: Received) => Promise<void>;
  log: Logger;
  visibilitySeconds?: number;
  waitSeconds?: number;
}

export interface ConsumerMetrics {
  processed: number;
  failed: number;
  poison: number;
  inFlight: number;
}

export function createConsumer(options: ConsumerOptions) {
  const { queue, log } = options;
  const visibility = options.visibilitySeconds ?? 60;
  const wait = options.waitSeconds ?? 1;
  const inFlight = new Map<string, { message: Received; done: Promise<void>; heartbeat: NodeJS.Timeout }>();
  const metrics: ConsumerMetrics = { processed: 0, failed: 0, poison: 0, inFlight: 0 };
  let running = false;
  let loop: Promise<void> | null = null;
  let slotFreed: (() => void) | null = null;

  const backoffSeconds = (receiveCount: number) => Math.max(1, Math.floor(Math.random() * Math.min(60, 2 ** receiveCount)));

  // SQS may hand out several messages of one FIFO group in a single batch (in order). They run one
  // after another, never side by side, or the per-group cap (two jobs per user) would not hold.
  const groupTail = new Map<string, Promise<void>>();

  function process(message: Received): void {
    const heartbeat = setInterval(() => {
      queue.setVisibility(message, visibility).catch(() => {});
    }, Math.max(1000, (visibility * 1000) / 3));
    const previous = groupTail.get(message.groupId);
    const done = (async () => {
      if (previous) await previous;
      try {
        if (!message.envelope) {
          metrics.poison++;
          log.error({ event: 'queue.poison', consumer: options.name, queue: message.queue, receiveCount: message.receiveCount }, 'unparseable message; dead-lettering');
          await queue.setVisibility(message, 0);
          return;
        }
        await options.handler(message);
        await queue.ack(message);
        metrics.processed++;
      } catch (error) {
        metrics.failed++;
        const retryIn = backoffSeconds(message.receiveCount);
        log.warn({ event: 'queue.handler_failed', consumer: options.name, queue: message.queue, type: message.envelope?.type, receiveCount: message.receiveCount, retryInSeconds: retryIn, errorName: error instanceof Error ? error.name : typeof error }, 'handler failed; will retry');
        await queue.setVisibility(message, retryIn).catch(() => {});
      } finally {
        clearInterval(heartbeat);
        inFlight.delete(message.receiptHandle);
        metrics.inFlight = inFlight.size;
        slotFreed?.();
      }
    })();
    groupTail.set(message.groupId, done);
    void done.then(() => {
      if (groupTail.get(message.groupId) === done) groupTail.delete(message.groupId);
    });
    inFlight.set(message.receiptHandle, { message, done, heartbeat });
    metrics.inFlight = inFlight.size;
  }

  async function poll(): Promise<void> {
    while (running) {
      const free = options.concurrency - inFlight.size;
      if (free <= 0) {
        await new Promise<void>((resolve) => (slotFreed = resolve));
        slotFreed = null;
        continue;
      }
      let got = 0;
      for (const [index, source] of options.sources.entries()) {
        if (!running || got >= free) break;
        try {
          // Only the last source long-polls, so a priority message is never kept waiting behind it.
          const messages = await queue.receive(source, { max: free - got, waitSeconds: index === options.sources.length - 1 && got === 0 ? wait : 0, visibilitySeconds: visibility });
          for (const message of messages) process(message);
          got += messages.length;
        } catch (error) {
          log.error({ event: 'queue.receive_failed', consumer: options.name, queue: source, errorName: error instanceof Error ? error.name : typeof error }, 'receive failed');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      // Nothing came back: pause before the next pass, so a queue that answers at once (an empty
      // queue with no long poll, the in-memory adapter) never turns this loop into a busy spin.
      if (got === 0 && running) await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return {
    metrics,
    start() {
      if (running) return;
      running = true;
      loop = poll();
    },
    /** Stops polling, waits up to `graceMs` for in-flight work, then releases the rest. */
    async stop(graceMs = 20_000): Promise<{ finished: number; released: number }> {
      running = false;
      slotFreed?.();
      await loop;
      const pending = [...inFlight.values()];
      const all = Promise.all(pending.map((p) => p.done));
      const settled = await Promise.race([all.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), graceMs))]);
      let released = 0;
      if (!settled) {
        for (const { message, heartbeat } of inFlight.values()) {
          clearInterval(heartbeat);
          await queue.setVisibility(message, 0).catch(() => {});
          released++;
        }
      }
      return { finished: pending.length - released, released };
    },
    /** Stops at once without releasing anything: a crashed process, for the drills and tests. */
    kill(): void {
      running = false;
      slotFreed?.();
      for (const { heartbeat } of inFlight.values()) clearInterval(heartbeat);
    },
  };
}

export type Consumer = ReturnType<typeof createConsumer>;
