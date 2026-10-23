# Deploy and rollback

**Owner role:** Backend on-call · **Approver:** IC for a rollback during an incident

The deploy pipeline is Connect item X-06, so it does not exist yet. This runbook fixes the rules
the pipeline must follow and the manual steps that work today.

## Rules

1. **Migrations are forward-only and expand/contract** (L8 once a shared `dev` exists). A release
   never needs its migration rolled back. Rolling back means deploying the previous image, which
   still works against the expanded schema.
2. **A snapshot is taken before every migration** (cloud, X-06). The migration runner is
   advisory-locked and checksummed: a changed migration file stops the run.
3. **The web image and the worker image ship together.** They are the same build with different
   entrypoints. Queue envelopes carry `schemaVersion`, and a consumer accepts the current and the
   previous version.
4. **Gates before deploy:** `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:integration`,
   `pnpm --filter @nextkin/server openapi:check` (breaking API changes fail), `pnpm check:pins`,
   `pnpm scan:secrets`, `pnpm scan:deps` (triaged), and the image scan (cloud: Inspector, X-06).
5. **Store builds lag.** Never remove or change an `/api/v1` field a released app reads. Raise
   `clients.minimum_version` in `app_settings` to force an update (the API answers 426).

## Deploy (local, today)

```sh
pnpm stack:up
pnpm migrate            # forward-only; prints each applied file
pnpm seed               # reference data only (plans, routing, prices); idempotent
pnpm web:build && pnpm --filter @nextkin/web start
pnpm worker
```

Check `/api/v1/health/deep` and `/api/v1/health/features`, then run one generation end to end.

## Deploy (cloud, X-06)

1. CI builds one image per commit, scans it and pushes it by digest.
2. The pipeline takes the Aurora snapshot, runs `migrate` as a one-off task, and waits for it.
3. A rolling ECS deploy of web, then worker. The load balancer uses the **shallow** health check,
   so a dependency blip never drains every task (R-08).
4. Watch for 15 minutes: 5xx rate, p95 latency against [`packages/server/perf-budgets.json`](../../packages/server/perf-budgets.json),
   DLQ depth, and `/health/features`.

## Rollback

1. **Decide fast.** If the 5xx rate or p95 is over budget 10 minutes after a deploy and the cause
   is not obvious, roll back first and investigate after.
2. Redeploy the previous image digest. Do not run a down-migration: there are none.
3. If the release wrote data in a new shape the old code cannot read, the expand/contract rule was
   broken. Treat it as Sev 2: fix forward with a patch release and record the gap.
4. If a feature is the problem and it has a kill switch, flipping the switch is faster than any
   deploy.
5. Check the DLQs after a rollback. Messages from the new version that the old one rejects land
   there. Replay them once the fixed version is out ([DLQ replay](dlq-replay.md)).
