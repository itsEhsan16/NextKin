# @nextkin/server

**The NextKin backend: the HTTP API, the worker, and (from P2) migrations and seed.**
- It is Node-only. `packages/shared` and the mobile app must never import it; a lint fence enforces
  that.
- The order of work is `doc/ImBackendImplementationPlan.md`.
- Local setup is `aws/setup/04-local-development.md`.

## How it runs

| Process | Entry | Started by |
|---|---|---|
| API | `src/http/app.ts`, mounted by `apps/web/app/api/v1/[[...route]]/route.ts` through `src/next.ts` | `pnpm web` (Next.js) |
| Worker | `src/entrypoints/worker.ts` | `pnpm worker` (tsx watch), or `dist/worker.mjs` in the image |
| Migrate | `src/entrypoints/migrate.ts` | The `migrate` image target (runner arrives in P2-01) |
| Stack init | `src/entrypoints/stack-init.ts` | `pnpm stack:init` (local stand-ins only) |

V2 §9.3 makes the Next.js server the API. That is why the route file in `apps/web` is one thin
catch-all, and everything else lives here, where it is tested with `app.request()` and no Next.

## Rules this package keeps

- **Configuration is read once** in `src/config`, validated by zod, with every problem named at
  start-up. Nothing else reads `process.env`; lint enforces it.
- **Local stand-ins are refused in staging and production** (rule L3), and so are endpoint overrides.
- **`server-only` is imported only by `src/next.ts`.** It throws outside Next's server layer, so the
  worker and the tests never load it.
- **Every external service sits behind a port**, with a contract suite per port from P4 onward.

## Commands

| Command | What it runs |
|---|---|
| `pnpm --filter @nextkin/server test` | Unit tests (no Docker) |
| `pnpm --filter @nextkin/server test:integration` | Against the compose stack (`pnpm stack:up` first) |
| `pnpm --filter @nextkin/server build` | Bundles the entrypoints into `dist/` with esbuild |
| `pnpm worker` | The worker with live reload |
| `pnpm --filter @nextkin/server openapi` | Regenerates `openapi.json` from the routes; commit it. CI fails on drift and on breaking changes (oasdiff) |
| `pnpm perf:smoke` | Runs the API in-process against the real stack and prints p50/p95 per route against `perf-budgets.json` |

## The API kernel (P3)

Every request runs this chain, in order (`src/http/app.ts`):
1. request id and trace;
2. security headers;
3. body limit;
4. client-version floor;
5. authentication;
6. CSRF;
7. rate limit;
8. per route, idempotency and kill switch;
9. zod validation;
10. response check;
11. error envelope.

To add a route:
- Declare it with `createRoute`, listing every response it can return.
- Throw `AppError` (`src/http/errors.ts`) for failures.
- Wrap the response body in `checked(schema, data)`.
- Put shared request and response shapes in `packages/shared/src/schemas`. Import the specific
  file, not the barrel.

## Identity (P4)

- Sign-in, sessions, federation and the mobile hand-off are described in
  [src/auth/README.md](src/auth/README.md).
- The identity contract suite (`test/integration/contracts/identity.int.test.ts`) runs against
  every adapter of the port. A new adapter (Cognito, X-07) must pass it unchanged.
- The authorization matrix (`test/integration/authzMatrix.int.test.ts`) lists every API operation
  and who may call it. A route missing from the matrix fails the suite.

## The first slice (P5)

- `/api/v1/profile` (`src/http/routes/profile.ts`, `src/services/profile*.ts`): every write answers
  with the whole profile and its ETag. Completeness is derived by `@nextkin/engines/completeness`.
- `/api/v1/me` (`src/http/routes/account.ts`, `src/services/account.ts`): the user, email change,
  security and sessions, the dashboard counters, activity, connected accounts, notification
  preferences.
- The clients reach both through the HTTP repositories in `packages/shared/src/repos/http`. The
  same contract suite (`packages/shared/test/contracts`) runs against the mock and, in
  `test/integration/repoContracts.int.test.ts`, against this server.
- Import `@nextkin/engines/<file>` and `@nextkin/shared/<path>/<file>`, never the barrels: plain
  Node cannot see names re-exported through `export *`, and lint enforces it.

## The async backbone and the AI layer (P6)

The queue, outbox, worker, pipeline runner, SSE stream and AI gateway are described in
[src/worker/README.md](src/worker/README.md), with the table of guarantees and the tests that
prove them.

## Uploads, scanning and parsing (P7)

Presigned uploads, the ClamAV scan gate, the isolated parser (hidden-text detection, OCR) and the
extraction cross-check are described in [src/parsing/README.md](src/parsing/README.md). Locally the
scan gate needs the `scan` profile: `pnpm stack:up -- --profile core --profile scan`.

## Generation and evals (P9)

JD intake, the generation stages, the claim ledger and the app cutover are described in
[src/pipeline/stages/README.md](src/pipeline/stages/README.md); the golden set and the release gate
in [evals/README.md](evals/README.md). `pnpm eval` runs the gate.
