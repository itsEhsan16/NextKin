// 200 concurrent SSE streams (P13-03, M5-18). Run with the worker STOPPED (README.md): each virtual
// user starts one run, which then stays queued, and holds that run's stream open. The server sends
// the replay and a heartbeat every 15 s until its ~5-minute close, then the user reconnects. k6's
// http client returns only when the server closes a stream, so what is measured is concurrency:
// 200 streams open at once, each answered 200 text/event-stream and held to the server's close,
// and the API still serving reads within budget meanwhile.
//
// Deviation from the plan's "held for 30 minutes": the server closes every stream at about 5
// minutes by design (clients reconnect with Last-Event-ID), so each stream is held for its whole
// life and reopened; DURATION sets how long the 200 are kept up.
//
// Rate classes: per user, 200 VUs over 30 accounts is about 7 starts + 7 streams in the first
// minute, under the `ai` class's 20.
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { API, budgets, headers, http, tokenFor, uuid } from './lib.js';

const STREAMS = Number(__ENV.STREAMS || 200);
const held = new Trend('sse_stream_held', true);

export const options = {
  scenarios: {
    streams: { executor: 'constant-vus', vus: STREAMS, duration: __ENV.DURATION || '6m', exec: 'stream', gracefulStop: '6m' },
    reads: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: __ENV.DURATION || '6m', preAllocatedVUs: 10, exec: 'read', startTime: '30s' },
  },
  thresholds: {
    'checks{check:stream opened}': ['rate>0.99'],
    'http_req_duration{name:GET /me (during streams)}': [`p(95)<${budgets.crud_read}`],
  },
};

let run = null; // per virtual user: each VU has its own runtime

export function stream() {
  const token = tokenFor(__VU);
  if (!run) {
    const res = http.post(`${API}/generations`, JSON.stringify({ kind: 'resume' }), {
      headers: headers(token, { 'idempotency-key': uuid() }),
      tags: { name: 'POST /generations' },
    });
    if (!check(res, { 'run started': (r) => r.status === 201 })) return;
    run = res.json('id');
  }
  const opened = Date.now();
  const res = http.get(`${API}/generations/${run}/events`, {
    headers: { ...headers(token), accept: 'text/event-stream' },
    timeout: '7m',
    tags: { name: 'GET /generations/{id}/events' },
  });
  check(res, {
    'stream opened': (r) => r.status === 200 && String(r.headers['Content-Type']).startsWith('text/event-stream'),
    'heartbeats received': (r) => String(r.body).includes(': heartbeat'),
  });
  const ms = Date.now() - opened;
  held.add(ms);
  // A stream that ends early (an error, or a run that finished) must not become a reconnect storm.
  if (ms < 60_000) sleep(10);
}

export function read() {
  const res = http.get(`${API}/me`, { headers: headers(tokenFor(1 + (__ITER % 30))), tags: { name: 'GET /me (during streams)' } });
  check(res, { 'read 200': (r) => r.status === 200 });
}
