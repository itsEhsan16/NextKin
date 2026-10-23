import { describe, expect, it } from 'vitest';
import { readServerSentEvents, type SseEvent } from '../src/repos/http/sse';

/** The phone-safe SSE reader (P6-14's reproduction), over a streamed Response split at awkward points. */

function streamed(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

describe('readServerSentEvents', () => {
  it('reads events split across chunks, skips heartbeats, and keeps ids', async () => {
    const events: SseEvent[] = [];
    await readServerSentEvents(
      streamed(['id: 7\nevent: stage_started\nda', 'ta: {"status":"generating"}\n\n: heartbeat\n\n', 'id: 8\r\nevent: completed\r\ndata: {"status":"ready"}\r\n\r\n']),
      (e) => events.push(e),
    );
    expect(events).toEqual([
      { id: '7', event: 'stage_started', data: '{"status":"generating"}' },
      { id: '8', event: 'completed', data: '{"status":"ready"}' },
    ]);
  });

  it('joins multi-line data and defaults the event name', async () => {
    const events: SseEvent[] = [];
    await readServerSentEvents(streamed(['data: a\ndata: b\n\n']), (e) => events.push(e));
    expect(events).toEqual([{ id: undefined, event: 'message', data: 'a\nb' }]);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const body = new ReadableStream({ start: (c) => c.enqueue(new TextEncoder().encode('data: x\n\n')) }); // never closes
    const events: SseEvent[] = [];
    const reading = readServerSentEvents(new Response(body), (e) => {
      events.push(e);
      controller.abort();
    }, controller.signal);
    await reading;
    expect(events).toHaveLength(1);
  });
});
