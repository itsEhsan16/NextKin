/**
 * A phone-safe Server-Sent Events reader (ImBackendImplementationPlan P6-13, P6-14). It reads a
 * streaming `fetch` response — `expo/fetch`, which SDK 57 installs as the global `fetch` on iOS and
 * Android and ships in Expo Go, and the browser's own `fetch` on web — and hands back each event.
 * The HTTP generations repository's `subscribe` (P9) uses it, with `lastEventId` to resume after a
 * drop and polling as the fallback when streaming is unavailable.
 *
 * No `EventSource`: it cannot send the bearer token mobile authenticates with.
 */

export interface SseEvent {
  id?: string;
  event: string;
  data: string;
}

/** Parses one SSE stream until it ends or `signal` aborts. Comments (heartbeats) are skipped. */
export async function readServerSentEvents(response: Response, onEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void> {
  if (!response.body) throw new Error('This fetch cannot stream response bodies.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const abort = () => void reader.cancel().catch(() => {});
  signal?.addEventListener('abort', abort);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let cut: number;
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const parsed = parseBlock(block);
        if (parsed) onEvent(parsed);
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

function parseBlock(block: string): SseEvent | null {
  let id: string | undefined;
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'id') id = value;
    else if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (data.length === 0 && id === undefined) return null;
  return { id, event, data: data.join('\n') };
}
