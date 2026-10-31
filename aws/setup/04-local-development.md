# 4 · Local development

**Owner: engineer** · **Time: about 15 minutes on a machine with Docker** · **Needs no AWS at all**

Every developer runs the whole backend on their own machine, with no cloud account, no credentials
and no spend. The order of work is `doc/ImBackendImplementationPlan.md`: local-first, decision D-22.
This page is P1-12 of that plan.

## What runs locally

Each stand-in speaks the same protocol as the AWS service it replaces, and the backend reaches it
through the real driver or AWS SDK with only an endpoint override (rule L1). No service has a
local-only code path.

| AWS service | Local stand-in | Compose profile | How faithful |
|---|---|---|---|
| Aurora PostgreSQL 17 | **PostgreSQL 17** | `core` | Effectively identical. Row-level security is a PostgreSQL feature, so the security model is real, not simulated |
| ElastiCache for Valkey | **Valkey 8** | `core` | Same protocol. Runs with persistence off on purpose: losing it must never be fatal |
| S3 | **SeaweedFS** | `core` | Good. Enforces presigned-POST size, content-type and key-prefix conditions, proven by `s3PresignedPost.int.test.ts` |
| SQS | **ElasticMQ** | `core` | Good. FIFO queues, message groups and DLQs. Messages are in memory, so a restart loses in-flight messages; the outbox (P6) republishes them |
| SES | **Mailpit** | `core` | Catches every email. The inbox is at http://127.0.0.1:8025 |
| GuardDuty malware scan | **ClamAV** | `scan` | Real scanning. It is the spec's own fallback (Appendix C #10) |
| Google / Apple sign-in | **mock-oauth2-server** | `auth` | Real OAuth flows (PKCE, ID tokens) against fake issuers |
| Observability (ADOT, X-Ray) | **Grafana LGTM** | `obs` | OpenTelemetry end to end. Grafana is at http://127.0.0.1:3001 |
| Stripe | **stripe-mock** | `pay` | API shape only. Stripe test mode replaces it once an account exists |
| LaTeX compile service (our own, toreview §111) | **The same sealed image** | `latex` | Identical: the production image, run with no network. See "The LaTeX compile service" |
| Cognito | **A local identity adapter** (P4) | none | **The weak one; see below** |
| Textract | **Tesseract** (P7) | none | Real OCR, lower quality |
| Claude Platform on AWS | **Recorded responses**, or your own **Claude API key** (D-23) | none | Recorded runs are deterministic and free. Live runs need synthetic data only and a spend cap |

MinIO was the stand-in in the earlier plan. Its community images stopped in October 2025 and the
project was archived in April 2026. LocalStack now needs an account token, and its free tier is
non-commercial. Neither is used.

## The honest caveat

**Cognito has no local equivalent.** Everything else on the list is the real software or a close
relative; identity is not. Authentication is the part you least want to test last: password flows,
Google and Apple sign-in, account linking in both orderings, session revocation, admin MFA.

The plan handles this with a port and two adapters (`IdentityProvider`, P4). Sessions, the
`requireUser` guard and the row-level-security binding are built and tested against the local
adapter, and the Cognito adapter slots in behind the same interface. **One contract suite runs
against both adapters.** That reduces the risk; it does not remove it. Connect identity first once
AWS exists (Connect item X-07).

## Setup

### 1. Prerequisites

| Tool | Version | Why that version |
|---|---|---|
| Node | **22.17.0** | Pinned in CI and in `apps/mobile/eas.json`. The server image runs Node 24, and server code stays 22-compatible |
| pnpm | **11.1.2** | The root `package.json` `packageManager` field |
| Docker Desktop | Recent, WSL2 backend on Windows | The service containers |

Every image version is pinned in [`docker/versions.env`](../../docker/versions.env). `pnpm check:pins`
fails on any unpinned image.

### 2. Configure

```bash
cp .env.example .env
```

Every value in `.env.example` is a local stand-in. The server validates the file at start-up and names
every missing or invalid variable at once (`packages/server/src/config`). The web app reads the same
root `.env`: `next.config.ts` loads it in development.

### 3. Start the stack

```bash
pnpm stack:up                       # core: postgres, valkey, seaweedfs, elasticmq, mailpit
pnpm stack:init                     # creates the five buckets, confirms the six queues (idempotent)
pnpm stack:up -- --profile scan     # add ClamAV when you need it (large first pull)
```

| Command | What it does |
|---|---|
| `pnpm stack:ps` | Shows what is running |
| `pnpm stack:logs` | Follows the logs |
| `pnpm stack:down` | Stops the stack and keeps the data |
| `pnpm stack:reset` | Stops the stack and **deletes every volume**: database, objects, everything |

Every port binds to 127.0.0.1, so no development service is reachable from your network.

### 4. Run the backend

```bash
pnpm dev:all     # stack up → stack:init → web + worker, with prefixed output
```

Or run each part separately:

```bash
pnpm web         # Next.js: the web app and the API at /api/v1
pnpm worker      # the background worker (heartbeat until P6 adds the queue consumers)
```

To prepare the database:

```bash
pnpm migrate              # applies aws/migrations as the owner role
pnpm seed                 # plans, rubric v1, role accounts, the mobile and web demo personas
pnpm seed -- --volume 5000   # optional: synthetic users for EXPLAIN and load work
```

The role accounts are `free@`, `pro@`, `admin@`, `curator@` and `support@nextkin.test`. The demo
personas are `george.smith@example.com` (mobile) and `george.smith@gmail.com` (web).

**If `next dev` is already running** when `next.config.ts` changes, restart it. Next only reads the
config, and with it the root `.env`, at start-up. Next also refuses to start a second dev server in
the same folder, so `pnpm dev:all` cannot run beside an existing `pnpm web`.

### 5. Check it

```bash
curl http://localhost:3000/api/v1/health          # {"status":"ok"}: liveness only
curl http://localhost:3000/api/v1/health/deep     # database, valkey, storage, queue
pnpm test                                          # unit tests; no Docker needed
pnpm test:integration                              # against the running stack
```

**`/health/deep` is for alarms and the degraded-mode banner, never for a load balancer.** It answers
503 when a shared dependency is down, and wiring it to the target group would drain every task at
once (R-08).

## Running the apps on the backend (P5)

Both apps run on the mock data layer until a flag sends a repository to the backend. Unset, nothing
changes. The flag takes `http` (every repository) or a list such as `user,profile`. With `http`, the sample
data is emptied and nothing answers from the mock. On a partial list, unserved methods stay on the mock and are listed
in `packages/shared/src/repos/http/*` (`*_FALLBACKS`); a production build refuses to start with one.

**Web**
1. `pnpm stack:up && pnpm migrate && pnpm seed`.
2. Start Next with the flag: `NEXT_PUBLIC_DATA_SOURCE=http pnpm web` (PowerShell:
   `$env:NEXT_PUBLIC_DATA_SOURCE='http'; pnpm web`). A dev server started before the root `.env`
   existed must be restarted to read it.
3. Open the app: with no session it goes to `/dev/sign-in`, which lists the seeded accounts
   (password `NextKin-local-2026`). That page exists only in development; web's real sign-in
   screens are design-gated.

**Mobile (Expo Go on a phone on the same Wi-Fi)**
1. Run Next on the LAN: `NEXT_PUBLIC_DATA_SOURCE=http pnpm web:lan` (listens on 0.0.0.0:3000). On
   Windows, allow inbound TCP 3000 on private networks once, from an elevated PowerShell:
   `New-NetFirewallRule -DisplayName "NextKin dev API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow`.
2. Create `apps/mobile/.env.local` (gitignored) with your machine's LAN address:
   ```
   EXPO_PUBLIC_DATA_SOURCE=http
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000
   ```
3. `pnpm mobile`, then open the app in Expo Go. Sign up: the code arrives in Mailpit
   (http://127.0.0.1:8025). Or sign in as a seeded account. Tokens are kept in the device keychain
   (expo-secure-store).
4. `[verify on a device]` Expo Go reaching plain `http://` on a LAN address, on iOS and on Android.
   If either refuses, use an HTTPS tunnel to port 3000 and point `EXPO_PUBLIC_API_BASE_URL` at it.

**Job links (toreview §144.3)** need the link reader. `pnpm dev:all` starts it on your Chromium
(`CHROMIUM_PATH`). On its own, run `pnpm --filter @nextkin/server link-reader` and give it and the
worker `LINK_READER_TOKEN_FILE`, the absolute path of `docker/link-reader/dev.token`, which
`pnpm stack:up` writes. Without it a link fails with a plain message.

**Trying the core loop on your phone**
1. Follow the Mobile steps above, and `pnpm dev:all` for the worker and link reader.
2. Sign up with a new email, and read the code in Mailpit.
3. Add a job: paste a Lever or company careers link. A LinkedIn or Indeed link should say the site
   doesn't let us read its pages.
4. Tailor a resume to it and download the PDF. "Did you apply?" should appear.
5. Answer yes: the job joins Applied. Close the app and reopen it: it is still there.
6. Open a job's page and tap Apply now: the employer's page opens, and coming back asks.
7. Open the bell: the finished run is listed, and tapping it opens the run.

**Importing a resume (P7)** needs the scan profile as well: `pnpm stack:up -- --profile core
--profile scan`, plus a running worker (`pnpm worker`, or `pnpm dev:all`). ClamAV is a 392 MB image
and needs about 1 GB of RAM once its signatures load; until it answers, every upload ends as
"We could not check this file", never as clean. Add `resumes` to the data-source flag (or use
`http`) to send imports to the backend. How a file travels is in
[packages/server/src/parsing/README.md](../../packages/server/src/parsing/README.md).

**Generating a document (P9)** needs a running worker too. `jd` and `generations` join the
`http` flag. Build Resume and Zero Resume run on the backend: JD → extraction → review → generate →
the result in the library. Tailor, the ATS check of a mock resume, cover letters from mock resumes,
and interview practice stay on the mock and are listed in `GENERATIONS_FALLBACKS`. The default
`LLM_ROUTE=recorded` answers only from recorded fixtures. Live generation needs
`LLM_ROUTE=claudeDirect` and an `ANTHROPIC_API_KEY` in the root `.env` (synthetic data only). A database seeded before P9 holds routing v1, so run `pnpm seed` once
more: it replaces an older routing version, never a newer one. `pnpm eval` runs the golden set
(see [packages/server/evals/README.md](../../packages/server/evals/README.md)).

**The library and downloads (P10)** join the `http` flag as `resumes`. Server documents are listed,
edited, regenerated by section, confirmed accurate and downloaded as real files. Documents the mock
still makes (an import's, a mock tailor's) stay in the mock library beside them. Downloads are
rendered by the worker:
- **Chromium.** Set `CHROMIUM_PATH` in the root `.env` to a downloaded Chromium (the
  `ms-playwright/chromium-*` build Playwright fetched).
- **Check.** `pnpm --filter @nextkin/server render-check` proves byte-identical PDFs and template
  certification on this machine. `docker run --rm nextkin-worker:local node dist/render-check.mjs`
  proves them in the image.
- **Delivery.** Files land in the `nextkin-exports` bucket, and the apps get a link valid for 15
  minutes.

How it fits together is in
[packages/server/src/export/README.md](../../packages/server/src/export/README.md).

**Discovery and coaching (P11)** add four repositories to the flag: `jobs`, `interview`,
`assistant`, plus `resumes.shareLink`.
- **Jobs.** Job search serves the fixture catalogue (`JOBS_ADAPTER=fixture`, the default). Adzuna and
  JSearch wait for D-12 and X-12. Applying and link import stay on the mock by decision.
- **Interview sets.** These run on the worker (Sonnet 5.5 with `claudeDirect`).
- **The assistant.** It answers in the web process: without `claudeDirect` it runs the
  deterministic stand-in, so it works with no key. `pnpm --filter @nextkin/server eval:assistant
  -- --live` measures the real classifier against the 95% bar.
- **A shared report** opens at `http://localhost:3000/r/<token>`.
- **The Skills Explorer** has only its API (`/api/v1/public/skills…`) until its pages are drawn.
  `pnpm seed` imports the starter KB unpublished.
- **Re-seed after migrating.** Run `pnpm seed` once more after `pnpm migrate`, for routing v3 and
  the new prompts. A database that already ran 0029 before 0030 can hold interview sets whose user
  is gone; delete those by hand (as the superuser) before 0030 validates.

**Admin, billing, quotas and privacy (P12)** add `support` to the flag; `user` is now fully served.
- **Billing.** `PAYMENT_ADAPTER=fake` (the default) sends upgrades to a local "Test checkout" page;
  paying there signs and delivers the webhooks, and the worker (`pnpm worker`) applies them, so the
  plan turns Pro a moment later. `pnpm stack:up -- --profile core --profile pay` starts stripe-mock
  for the Stripe adapter's contract test (`contracts/payments.int.test.ts`).
- **Quotas.** A run reserves its meter when it starts and is charged when it finishes; Free's caps
  answer `PLAN_LOCKED` with the reset date before any work starts.
- **AI consent.** The first AI action of an account without consent opens the consent dialog. The
  personas have consented; the role accounts (free@, pro@) have not, so the dialog can be tried.
- **Admin.** Staff sign in with `POST /api/v1/auth/admin/login` (password and TOTP; the seed prints
  the TOTP URI) and use `/api/v1/admin/…`. There is no admin UI yet.
- **Privacy.** `DELETE /api/v1/me` ends every session at once; the daily `account_purge` job removes
  the rest. Data exports are built by the worker into `nextkin-exports`.
- **Support.** Tickets go to `SUPPORT_INBOX`, which Mailpit shows (http://127.0.0.1:8025).

**A second dev server** (a verification run, or a parallel session while yours holds port 3000):
`NEXT_DIST_DIR=.next-verify APP_ORIGIN=http://localhost:3101 API_PUBLIC_URL=http://localhost:3101 npx next dev -p 3101`
from `apps/web`. The origin has to match the port, or login CSRF refuses the sign-in. Next rewrites
`apps/web/tsconfig.json` and `next-env.d.ts` to point at the alternate directory, so revert those
two afterwards.

## The container image

```bash
pnpm stack:up -- --profile app      # builds and runs the production web and worker images
```

`docker/Dockerfile` builds three targets from one definition:

| Target | Contents |
|---|---|
| `web` | The Next.js standalone server |
| `worker` | The bundled worker, plus Chromium and the Liberation Sans and Carlito fonts for PDF export |
| `migrate` | The migration task |

Every target runs as a non-root user, with `tini` as PID 1. **The worker target downloads Chromium
and its system libraries, several hundred MB.**

### The LaTeX compile service

```bash
pnpm stack:up -- --profile latex    # builds nextkin-latex:local the first time, then latex + latex-relay
```

The `latex` target is Tectonic 0.17.0 (checksum-pinned in `docker/versions.env`) plus only the TeX
Live 2022 bundle files the resume template uses. The build compiles the template's own output for
every density and paper (`latex-warmup`) to fill Tectonic's cache, then compiles it again with
`--only-cached` under `RUN --network=none`, so a missing file fails the build, not a user's export.

- `latex` sits only on the `latex-sealed` network (`internal: true`): no internet, no host. Its root
  is read-only, `/tmp` (a tmpfs) is the only writable path, it has no capabilities, and the bearer
  token file is its only secret. Each compile runs `tectonic -X compile main.tex --untrusted
  --only-cached --hide <token file>` with a 15 s wall-clock kill, then `pdfinfo` and `pdftoppm -r 110`.
- **Docker Desktop cannot publish a port from an internal network** (checked 2026-10-19), so the host
  reaches it through `latex-relay`: a TCP relay from the same image, on `latex-sealed` and
  `latex-edge`, publishing only `127.0.0.1:8790`. A worker inside compose would use `latex:8790`.
- `pnpm stack:up` writes a random token to `docker/latex/dev.token` (gitignored) the first time.
  Point the worker at it with `LATEX_COMPILER_TOKEN_FILE` (an absolute path; see `.env.example`).

To prove Chromium renders inside the image:

```bash
docker run --rm nextkin-worker node dist/render-check.mjs
```

## Hardening tools (P13)

| Command | What it does | Record |
|---|---|---|
| `pnpm drills` | Kills a worker mid-stage and restarts Valkey, Postgres and ElasticMQ against the running stack | [`aws/drills/`](../drills/) |
| `node scripts/drills/restore.mjs --volume 5000` | Dump, restore into a fresh database, verify under RLS, time each step | [`aws/runbooks/restore.md`](../runbooks/restore.md) |
| `pnpm load:users 30` then `pnpm load crud|generations|sse` | k6 baselines in the pinned container against `next start` | [`tests/load/README.md`](../../tests/load/README.md) |
| `pnpm dlq list`, `pnpm dlq:replay` | Inspect and replay dead letters (dry run unless `--apply`) | [`aws/runbooks/dlq-replay.md`](../runbooks/dlq-replay.md) |
| `pnpm scan:secrets`, `pnpm scan:deps` | gitleaks and OSV-Scanner in pinned containers | [`aws/security/checklist-local.md`](../security/checklist-local.md) |
| `GET /api/v1/health/features` | Which capabilities are degraded (`ai`, `jobs`, `payments`, `email`); both apps show a banner | [`aws/runbooks/ai-failover.md`](../runbooks/ai-failover.md) |

The drills restart containers, so run them on their own, never alongside `test:integration`.
The federated sign-in case against the real mock-oauth2 container runs when the `auth` profile is
up (`docker compose --env-file docker/versions.env --profile auth up -d mock-oauth2`); without it,
the case is skipped.

## Machine notes (Windows reference machine, 2026-10-10)

| Item | Value |
|---|---|
| Docker Desktop | 4.84.0, installed per user at `%LOCALAPPDATA%\Programs\DockerDesktop` |
| Engine | 29.6.2 |
| Memory given to containers | 7.6 GiB, the WSL2 default (half of the 15.7 GB of RAM) |
| CPUs | 24 |

Docker Desktop does not start with Windows on this machine. Start it before `pnpm stack:up`.

**Memory:**
- **Measured:** the `core` profile idles at about **160 MB** in total.
- **Estimated:** ClamAV needs about 1.5 GB once its signatures load, and the worker image with
  Chromium needs 1–2 GB while rendering.

7.6 GiB holds `core` + `app` + `scan` comfortably. To run every profile at once, raise the limit in
`%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
memory=10GB
```

Then run `wsl --shutdown` and restart Docker Desktop.

**Phone access (from P5).** Expo Go on a phone reaches the API on the laptop's LAN IP, port 3000. The
first time Node listens on the network, allow it through Windows Firewall for **private networks
only**.

## Done when (P1 exit)

- [x] `pnpm stack:up` turns every core healthcheck green on a clean machine
- [x] `pnpm stack:init` creates the buckets and confirms the queues, idempotently
- [x] `/api/v1/health` and `/api/v1/health/deep` answer through Next (proven on a production build).
  Deep health reports a stopped Valkey as degraded while shallow health stays 200
- [x] The worker starts and logs a heartbeat with every dependency OK
- [x] `pnpm test` and `pnpm test:integration` are green for the new packages
- [x] The web, worker and migrate images build (419 MB, 1.8 GB and 345 MB).
- [x] Chromium renders a PDF inside the worker image, which runs as a non-root user.
- [x] The web image serves deep health on the compose network.
- [ ] A second person reaches green health checks from this page alone

Later phases add `pnpm migrate`, `pnpm seed`, sign-in and generation. The end-to-end proof (sign in,
profile, JD, generate, progress, score, PDF) arrives with P10.

## Next

[Step 5 — first deployment](05-first-deployment.md), once the accounts from step 3 exist (Connect
items X-03 to X-06).
