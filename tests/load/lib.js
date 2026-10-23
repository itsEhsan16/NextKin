// Shared helpers for the k6 baselines (ImBackendImplementationPlan P13-03). See README.md.
import http from 'k6/http';
import { SharedArray } from 'k6/data';

export const BASE = __ENV.BASE_URL || 'http://host.docker.internal:3000';
export const API = `${BASE}/api/v1`;

// Bearer tokens from `pnpm load:users`; one virtual user maps to one account.
export const tokens = new SharedArray('tokens', () => JSON.parse(open('./.tokens.json')));

export function tokenFor(vu) {
  return tokens[(vu - 1) % tokens.length];
}

export function headers(token, extra = {}) {
  return { authorization: `Bearer ${token}`, 'x-nextkin-client': 'mobile', 'content-type': 'application/json', ...extra };
}

export function uuid() {
  // Idempotency keys only need to be unique per user; crypto.randomUUID exists in k6 >= 0.49.
  return crypto.randomUUID();
}

/** Budgets from packages/server/perf-budgets.json, by route class. */
export const budgets = JSON.parse(open('../../packages/server/perf-budgets.json')).budgets.reduce((acc, b) => ({ ...acc, [b.class]: b.p95Ms }), {});

export { http };
