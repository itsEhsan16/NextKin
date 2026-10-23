# Load baselines (k6)

ImBackendImplementationPlan P13-03. These are relative baselines on one machine; the binding
numbers come from the ALB at X-15. Results so far: [`aws/drills/load-2026-10-16.md`](../../aws/drills/load-2026-10-16.md).

| Script           | Measures                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `crud.js`        | p95 per route class against `packages/server/perf-budgets.json`          |
| `generations.js` | 500 generations in 5 minutes: all start, all reach a terminal state      |
| `sse.js`         | 200 concurrent event streams held to the server's close, reads meanwhile |

k6 runs in the pinned container (`K6_IMAGE` in `docker/versions.env`), so nothing is installed on
the host.

## Run

```sh
pnpm stack:up
pnpm web:build
# The production server, with the fake model (no provider calls, no spend):
cd apps/web && LLM_ROUTE=fake node --env-file=../../.env ../../node_modules/next/dist/bin/next start -p 3000
# In another terminal, the worker (stop it for sse.js):
cd packages/server && LLM_ROUTE=fake node --env-file=../../.env --import tsx src/entrypoints/worker.ts

pnpm load:users 30                 # 30 synthetic Pro users; tokens valid 60 minutes
pnpm load crud -- -e VUS=30 -e DURATION=2m
pnpm load generations
pnpm load sse                      # with the worker STOPPED, so runs stay live
pnpm dlq list                      # the generation DLQs must be empty afterwards
pnpm load:users -- --remove        # when done
```

Summaries go to `tests/load/results/` (gitignored). Copy the numbers into a dated record in
`aws/drills/`.

## Rate classes shape the scripts

The API limits each user per minute (`src/http/middleware/guards.ts`):
- the default class allows 300;
- the `ai` class, every `/generations` route including polls and streams, allows 20;
- auth allows 10 per IP.

So:
- `crud.js` paces each user at about 200 requests a minute and leaves generation routes out.
- `generations.js` spreads 500 starts over 30 users, about 3 a minute each.
- `sse.js` puts about 7 streams on each account.
- `pnpm load:users` signs in through the identity adapter in-process, not the per-IP-limited
  route.

A 429 in a result means the script, not the server, is wrong.

## Notes

- `next start` does not read the root `.env` (production never reads a file), hence
  `--env-file`. Sourcing `.env` in a shell fails on the unquoted `EMAIL_FROM`.
- Stopping the worker started with `npx` can leave its node child running. Start it with `node`
  directly as above, and check that no `worker.ts` process is left before `sse.js`.
