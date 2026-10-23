import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Valkey from 'iovalkey';
import { createValkeyIdempotencyStore } from '../cache/valkeyStores';
import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { createFlags } from '../flags/flags';
import { createDependencyChecks } from '../health/checks';
import { createApi } from '../http/app';
import { stableId } from '../seed/ids';

/**
 * Performance smoke (ImBackendImplementationPlan P3-12, R-05): drives the real API in-process,
 * against the real database and Valkey, through the whole middleware chain, signed in as the seeded
 * mobile persona. Reports p50 and p95 per route against perf-budgets.json. Network and TLS are
 * not in the number, so it is a relative baseline; binding numbers are measured at the ALB (X-15).
 * Local and test only (it injects an identity). Run `pnpm seed` first.
 */
interface Budget {
  class: string;
  p95Ms: number;
}

const config = loadConfig();
if (!['local', 'test'].includes(config.APP_ENV)) {
  console.error('perf-smoke injects an identity and is refused outside local and test.');
  process.exit(1);
}

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, '../../perf-budgets.json'), 'utf8')) as {
  budgets: Budget[];
  routes: Record<string, string>;
};
const ITERATIONS = Number(process.argv[2] ?? 200);
const userId = stableId('user:mobile');

const db = createDatabase({ appUrl: config.DATABASE_URL, poolMax: config.DATABASE_POOL_MAX });
const valkey = new Valkey(config.VALKEY_URL);
const app = createApi({
  checks: createDependencyChecks(config),
  db,
  config: { appEnv: config.APP_ENV, cursorSecret: config.CURSOR_SECRET },
  rateLimiter: { hit: async (_key, limit) => ({ allowed: true, limit, remaining: limit, resetSeconds: 60 }) },
  idempotency: createValkeyIdempotencyStore(valkey),
  flags: createFlags(db),
  authenticate: async () => ({ identity: { userId, role: 'user' }, via: 'bearer' }),
});

const ROUTES: [string, string][] = [
  ['GET /api/v1/health', '/api/v1/health'],
  ['GET /api/v1/health/deep', '/api/v1/health/deep'],
  ['GET /api/v1/me/settings', '/api/v1/me/settings'],
  ['GET /api/v1/me/links', '/api/v1/me/links?limit=20'],
];

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
let failed = false;

try {
  for (const [name, path] of ROUTES) {
    const timings: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const started = performance.now();
      const res = await app.request(path);
      await res.arrayBuffer();
      if (res.status >= 400) throw new Error(`${name} answered ${res.status}; run pnpm seed and pnpm stack:up first`);
      timings.push(performance.now() - started);
    }
    timings.sort((a, b) => a - b);
    const budget = budgets.budgets.find((b) => b.class === budgets.routes[name]);
    const p95 = percentile(timings, 0.95);
    const over = budget ? p95 > budget.p95Ms : false;
    failed ||= over;
    console.log(
      `${name.padEnd(28)} p50 ${percentile(timings, 0.5).toFixed(1).padStart(6)} ms   p95 ${p95.toFixed(1).padStart(6)} ms   budget ${budget?.p95Ms ?? '-'} ms ${over ? '  OVER' : ''}`,
    );
  }
} finally {
  await db.destroy();
  await valkey.quit();
}
process.exit(failed ? 1 : 0);
