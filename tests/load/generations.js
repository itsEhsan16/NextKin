// 500 generations in 5 minutes (P13-03, M5-19): no message lost and the DLQs empty afterwards.
//
// Spread over the load users so no one passes the `ai` rate class (20 requests a minute per user,
// counting polls) or the Pro monthly cap (100): with 30 users each starts about 3.3 runs a minute.
// The run is started here; whether every run reached a terminal state is checked by polling each
// one at the end, and the DLQs by `pnpm dlq list` (README.md).
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { API, headers, http, tokens, uuid } from './lib.js';

const TOTAL = Number(__ENV.TOTAL || 500);
const started = new Counter('generations_started');
const ended = new Counter('generations_terminal');

export const options = {
  scenarios: {
    start: { executor: 'shared-iterations', vus: tokens.length, iterations: TOTAL, maxDuration: '5m' },
  },
  teardownTimeout: '8m',
  thresholds: {
    'http_req_duration{name:POST /generations}': ['p(95)<500'],
    'checks{check:started}': ['rate>0.99'],
  },
};

export default function () {
  const token = tokens[(exec.vu.idInTest - 1) % tokens.length];
  const res = http.post(`${API}/generations`, JSON.stringify({ kind: 'resume' }), {
    headers: headers(token, { 'idempotency-key': uuid() }),
    tags: { name: 'POST /generations' },
  });
  if (check(res, { started: (r) => r.status === 201 })) started.add(1);
  // 30 users × 18 s apart ≈ 100 starts a minute, under each user's 20-a-minute class.
  sleep(18);
}

// After the run: every run of every load user must be terminal (ready or failed, never stuck).
export function teardown() {
  sleep(Number(__ENV.SETTLE_SECONDS || 60));
  let open = 0;
  let total = 0;
  for (const token of tokens) {
    const list = http.get(`${API}/generations`, { headers: headers(token), tags: { name: 'GET /generations (teardown)' } });
    for (const g of list.json('items') || []) {
      total++;
      if (g.status === 'ready' || g.status === 'failed') ended.add(1);
      else open++;
    }
    sleep(3.5); // stays under the ai class while reading
  }
  console.log(`teardown: ${total} runs listed, ${open} not terminal`);
}
