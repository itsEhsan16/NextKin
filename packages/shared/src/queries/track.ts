import { repos } from '../repos';
import type { EventName, ProductEvent } from '../schemas/events';

/**
 * Usage events, batched and sent in the background (owner, 2026-10-31). Telling us where people get
 * stuck must never get in their way: a batch that fails is dropped, not retried, and no screen
 * waits on it. The server drops everything from someone who opted out.
 */

const FLUSH_MS = 20_000;
const FLUSH_AT = 10;

let queue: ProductEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushEvents(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  repos.events.send(events).catch(() => undefined);
}

export function track(name: EventName, properties?: ProductEvent['properties']): void {
  queue.push({ name, at: new Date().toISOString(), ...(properties ? { properties } : {}) });
  if (queue.length >= FLUSH_AT) {
    flushEvents();
    return;
  }
  if (timer) return;
  timer = setTimeout(flushEvents, FLUSH_MS);
  // Node's timers would hold a test run open; a phone's and a browser's return a number.
  (timer as { unref?: () => void }).unref?.();
}
