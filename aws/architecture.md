# AWS architecture

What exists on AWS, what each piece does, and how a request travels through it.

This is the **operational reference** — the thing to keep open while building. The argument for *why*
each service was chosen over the alternatives is in `doc/NextKin-Backend-Architecture.md` (decisions
D1–D15) and is not repeated here.

---

## 1. The picture

```
                    ┌─────────────┐        ┌──────────────┐
                    │   Browser   │        │  Phone app   │
                    │  apps/web   │        │ apps/mobile  │
                    └──────┬──────┘        └──────┬───────┘
                           │                      │
                           └───────────┬──────────┘
                                       │  HTTPS
                          ┌────────────▼────────────┐
                          │   CloudFront  +  WAF    │   global edge
                          │   (the only public IP)  │   US · Frankfurt · Sydney
                          └────────────┬────────────┘
                                       │  private VPC origin
    ═══════════════════════════════════│═══════════════════════════ VPC boundary
                          ┌────────────▼────────────┐
                          │  Internal ALB (2 AZs)   │   no public address
                          └────────────┬────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │        ECS Fargate  ·  web          │   THE FAST HALF
                    │   min 2 / max 8 · arm64 · 1vCPU/2GB │   answers in < 300 ms
                    │   Next.js API routes  /api/v1/*     │   never calls an AI model
                    └───┬─────────┬──────────┬────────┬───┘
                        │         │          │        │
              ┌─────────▼──┐  ┌───▼────┐  ┌──▼─────┐  │ enqueue
              │  Aurora    │  │ Valkey │  │   S3   │  │ {generation_id}
              │ PostgreSQL │  │ cache  │  │ 5      │  │
              │ Serverless │  │ session│  │ buckets│  │
              │ v2 · RLS   │  │ limits │  └────────┘  │
              └─────▲──────┘  └───▲────┘              │
                    │             │         ┌─────────▼─────────┐
                    │             │         │   SQS FIFO  x3    │
                    │             │         │ priority ·        │
                    │             │         │ standard ·        │
                    │             │         │ maintenance       │
                    │             │         │ (+ DLQ each)      │
                    │             │         └─────────┬─────────┘
                    │             │                   │
                    │      ┌──────┴───────────────────▼──────────┐
                    └──────┤     ECS Fargate  ·  worker          │   THE SLOW HALF
                           │  min 1 / max 6 · 2GB for Chromium   │   45–90 s per generation
                           │  same image, different entrypoint   │   scales on queue backlog
                           └──────┬──────────────────────┬───────┘
                                  │                      │
                     ┌────────────▼──────────┐   ┌───────▼────────┐
                     │  Claude Platform      │   │   Textract     │
                     │  on AWS  (primary)    │   │   (OCR)        │
                     │    ↓ Bedrock          │   └────────────────┘
                     │    ↓ OpenAI           │
                     └───────────────────────┘

         EventBridge Scheduler ──▶ maintenance queue ──▶ worker (cron work)
```

**The one thing to understand:** there are two halves. `web` answers screen taps in milliseconds and
never does AI work. `worker` does the slow work off a queue. They are the same container image started
with a different entrypoint — one build, one deployment, two roles.

---

## 2. Resource inventory

Every AWS resource, what it is for, and the configuration that matters. `[verify]` marks a fact that
expires and must be re-checked at build time (spec Appendix C).

### Compute

| Resource | Configuration | Notes |
|---|---|---|
| **ECS cluster** | Fargate, arm64/Graviton | One cluster per environment |
| **`web` service** | min 2 / max 8 tasks · 1 vCPU / 2 GB · 2 AZs | Scales on CPU 60% and ALB `RequestCountPerTarget`. Health check `/api/v1/health` |
| **`worker` service** | min 1 / max 6 tasks · 1 vCPU / 2 GB | 2 GB is for Chromium. Scales on **queue backlog per task**, not CPU. At least one always warm so the 3-minute generation SLA holds during a burst. Fargate Spot in non-production |
| **`migrate` task** | One-off task definition | Runs schema migrations as the database **owner** role, from the deployment pipeline |
| **ECR** | One repository, arm64 images | Amazon Inspector scans every image; a critical finding blocks deployment |

The container image is multi-stage: Next.js in `output: 'standalone'` mode, plus Playwright/Chromium
and bundled metric-compatible fonts for the worker. `apps/web/next.config.ts` already sets
`output: 'standalone'` and `compress: false` — the latter so streamed responses are never buffered.

### Edge and network

| Resource | Configuration | Notes |
|---|---|---|
| **CloudFront** | One distribution per environment, VPC origin to the internal ALB `[verify]` | The only public entry point |
| **AWS WAF** | Managed rule sets · rate-based rules on auth, AI and search routes · Challenge on anonymous endpoints · stricter group on `/admin/*` | **Payment webhook paths are excluded from rate rules** — signature verification is the control there |
| **ALB** | **Internal**, 2 AZs, idle timeout ≥ 120 s | Reachable only through the CloudFront VPC origin |
| **VPC** | Private subnets for tasks · isolated subnets for database and cache | No task has a public IP. Database and cache have no internet route at all |
| **NAT gateway** | **Single** at launch | A deliberate trade consistent with the 99.5% target. A second NAT is ~$33/month and is the documented upgrade to 99.9% |
| **S3 gateway endpoint** | In the VPC | Document traffic never crosses the NAT — no data-processing charge, no internet exposure |
| **Route 53 + ACM** | Hosted zone, certificates | The Cognito custom domain needs a certificate in `us-east-1`, which our region choice makes trivial |

**CloudFront behaviours, by route class** — getting these wrong is the most common cause of a broken
stream or a leaked private response:

| Route class | Caching | Compression | Notes |
|---|---|---|---|
| `/_next/static/*` | Immutable, long TTL | On | Content-hashed filenames |
| Public pages (Skills Explorer, marketing) | `s-maxage` + `stale-while-revalidate` | On | SEO-critical |
| Authenticated routes | **`private, no-store`** | On | Never cached at the edge |
| **SSE routes** (`/generations/:id/events`, assistant messages) | **Disabled** | **Disabled** | Origin response timeout **60 s**. Compression would buffer the stream and break live progress |
| Payment webhooks | Disabled | — | Excluded from WAF rate rules |

### Data

| Resource | Configuration | Notes |
|---|---|---|
| **Aurora PostgreSQL Serverless v2** | Production writer **1–8 ACU**, scale-to-zero **disabled** in production | A ~15 s resume from zero is unacceptable on a user request. Non-production uses scale-to-zero |
| | Optional 0.5-ACU reader | Failover target and read offload. A de-scope lever at launch |
| | 7-day PITR, Performance Insights on, deletion protection on | PITR extendable to 35 days |
| | Isolated subnets | Security group admits only `web`, `worker` and `migrate` |
| | **No RDS Proxy** | Fargate tasks hold their own pools. The proxy bills ~$88/month minimum and can pin sessions on `SET`, which breaks the row-level-security pattern |
| **ElastiCache Serverless for Valkey** | 100 MB minimum, multi-AZ | Sessions · rate limits · idempotency keys · job-search cache · circuit breakers · JD extraction cache · the shared Next.js ISR cache handler |

**Row-level security** is the property that matters most. Every user-owned table has
`ENABLE` + `FORCE ROW LEVEL SECURITY`, policies key on a per-transaction `app.user_id` variable set
from the verified identity, and the application connects as a role that is **not** the table owner and
has **no `BYPASSRLS`**. A bug in the API layer still cannot return another user's resume. See
[`migrations/README.md`](migrations/README.md).

### Storage — five buckets, one purpose each

| Bucket | Holds | Access | Lifecycle |
|---|---|---|---|
| `uploads` | User resumes and JDs, keyed `users/<user_id>/…` | Presigned **POST** in, worker role reads, presigned GET out | Kept with the account · versioned · copied to the DR region |
| `anonymous-uploads` | Try-before-signup teaser uploads | Presigned POST, worker reads | **Hourly purge at 24 h**, with a 1-day lifecycle rule as backstop. Copied into the user's prefix on conversion |
| `exports` | Rendered PDF / DOCX / TXT | Worker writes, presigned GET **≤ 15 min** | Deleted by reference with the resume version |
| `audit-archive` | Nightly audit-log exports | Worker writes once | **Object Lock, compliance mode, 12+ months.** Cannot be deleted by anyone |
| `public-assets` | Template previews, OG images, marketing | CloudFront via origin access control | — |

All buckets: SSE-KMS with a customer-managed key, bucket keys enabled to cut key-service cost, and
account-level Block Public Access.

**Two details that are easy to get wrong:**
- **Presigned POST, not PUT.** Only POST policy conditions can enforce a maximum object size. With PUT
  the size limit has to be enforced in application code, which can be bypassed.
- **The malware gate.** GuardDuty Malware Protection scans `uploads` and `anonymous-uploads`. The
  bucket policy **denies `s3:GetObject` on any object lacking the clean-scan tag** `[verify]`, and the
  scan-result event is what releases the parse job. An infected file is never read by the parser.

### Async

| Resource | Configuration | Notes |
|---|---|---|
| `generation-priority` | SQS **FIFO**, KMS-encrypted, + DLQ | Pro subscribers. Drained first |
| `generation-standard` | SQS FIFO, + DLQ | Free tier |
| `maintenance` | SQS FIFO, + DLQ | Fed by EventBridge Scheduler |
| **EventBridge Scheduler** | Cron | Hourly anonymous-upload purge · daily trash purge and `jobs_cache` expiry · daily trending recompute · nightly eval run · weekly KB refresh |

**The message is just `{generation_id}`.** All data stays in PostgreSQL, so there is no payload size
limit to design around.

**The message group ID is `user_id#slot`** where slot ∈ {0,1}. That is what caps a single user at two
concurrent generations and stops one heavy user monopolising throughput.

**Alarms on both DLQ depth and oldest-message age.** Depth alone misses a queue that is slowly
poisoning.

### Identity

| Resource | Configuration |
|---|---|
| **`users` pool** | Cognito, Essentials tier. Email/password via SRP from our own UI; Google and Apple via federation with direct `identity_provider` deep links |
| **`admins` pool** | Separate pool, **MFA required** — Cognito MFA policy is pool-wide, not per-group. An admin who is also a job seeker holds two identities |

**Settings that cannot be changed after the pool is created**, so they are decided before anything is
built: `email` as the sign-in alias · case-insensitive usernames · required attributes `email` and
`name` · *Prevent user existence errors* enabled · refresh-token rotation enabled · access/ID token
lifetime 60 minutes · refresh-token lifetime 30 days (the absolute session lifetime).

Sessions are **server-side**: the browser holds an opaque cookie, the Cognito tokens live in Valkey.
That is what makes logout instant and real rather than cosmetic.

**One limitation, stated plainly:** Cognito user pools cannot be replicated to another region and
password hashes cannot be exported. In a full regional failure, users sign in again via Google/Apple
or reset their password against a rebuilt pool. This is in the incident runbook and the status-page
communications plan.

### AI

Three providers in a chain, so an outage degrades rather than stops the product:

| Order | Provider | Why |
|---|---|---|
| 1 | **Claude Platform on AWS** | Authenticates with the ECS task role — **no API key to store, leak or rotate**. Billed on the AWS invoice. Full feature parity including Message Batches at a 50% discount `[verify]` |
| 2 | **Amazon Bedrock** | The **same models**, so a failover preserves output quality. No Batches |
| 3 | **OpenAI** | Last resort. Key in Secrets Manager |

**Model IDs are configuration, not code** — they live in the `app_settings` routing table, so changing
which model runs which pipeline stage is an admin change, not a deployment.

Only the `worker` task role may invoke models (plus `web`, for the assistant's streaming path only),
scoped to specific model ARNs. CloudTrail records every invocation's identity.

### Security, secrets and observability

| Resource | Purpose |
|---|---|
| **KMS** | Customer-managed keys for Aurora, S3, SQS, CloudWatch Logs, Secrets Manager, ECS ephemeral storage |
| **Secrets Manager** | One KMS-encrypted secret per external provider. Nothing in images, env files or client bundles. The primary AI path has no secret at all |
| **CloudTrail** | All accounts, delivered to the security account |
| **GuardDuty** | Threat detection, plus Malware Protection for S3 |
| **Security Hub** | Foundational Security Best Practices standard, findings triaged as a release gate |
| **CloudWatch** | Logs (PII-scrubbed), EMF metrics, dashboards, alarms → SNS → Slack |
| **X-Ray + ADOT** | Distributed tracing |
| **Synthetics** | Canaries for login, a full generation round-trip, and job search |
| **Sentry** | Client and server error tracking with release tagging |

---

## 3. How a request travels

### A fast request — "show my resumes"

```
Browser → CloudFront (WAF check) → private origin → internal ALB → web task
   → session lookup in Valkey → SET app.user_id inside the transaction
   → Aurora query (RLS filters to this user) → JSON response
```

**Target: under 300 ms p95 for reads, 500 ms for writes**, measured at the ALB. German and Australian
users add 90–150 ms of unavoidable ocean crossing, absorbed by terminating the connection at the
Frankfurt and Sydney edges.

### A slow request — "write me a resume for this job"

```
1. POST /api/v1/generations  (with an Idempotency-Key)
   → web writes a `generations` row as `queued`
   → drops {generation_id} on the queue
   → RETURNS IMMEDIATELY (milliseconds)

2. Browser opens GET /api/v1/generations/:id/events  (SSE, 15 s heartbeat)

3. worker picks up the message and runs the stages, checkpointing after each:
      extract JD → compare profile → write resume
      → VALIDATE TIMELINE (plain code, no AI) → score → cover letter → persist

4. Each stage writes its progress; the SSE stream pushes it to the screen

5. On completion, and only on completion, the user's quota is charged
```

**Targets: p50 under 45 s, p95 under 90 s, and ≥ 99% of jobs reach a terminal state within 3 minutes.**
A job exceeding that is auto-failed with a visible retry rather than left spinning.

**Why this shape:** a dropped connection cannot lose a generation; a bad response at stage 5 does not
make us pay for stages 1–4 again; a traffic spike queues instead of falling over; and because quota is
charged on completion rather than submission, **a retry never double-charges the user**.

### An upload

```
1. App asks the API for an upload ticket
2. API returns a presigned POST with max size and allowed type baked into the policy
3. FILE GOES FROM THE DEVICE STRAIGHT TO S3 — it never touches our servers
4. GuardDuty scans the object and tags it
5. The scan-result event releases the parse job onto the queue
6. Worker reads the object (only possible because it carries the clean tag) and parses it
```

---

## 4. Environments and accounts

| Environment | Account | Purpose |
|---|---|---|
| **local** | none | Everything in `docker compose` — Postgres, Valkey, SeaweedFS (S3), ElasticMQ (SQS), Mailpit (SES), plus opt-in ClamAV. No cloud needed for day-to-day work ([setup/04](setup/04-local-development.md)) |
| **dev** | `nonprod` | Shared integration. Deploys automatically on every merge |
| **preview** | `nonprod` | Opt-in temporary environment per pull request, auto-destroyed after 3 days |
| **staging** | `nonprod` | Release-candidate validation, load tests, security tests. Production shape at reduced size. **Never production PII** |
| **prod** | `prod` | Live |

**Production and non-production are separate AWS accounts.** One mistake in development physically
cannot reach production data, credentials or quotas. About two engineer-days now; genuinely painful to
retrofit once real customer data exists.

Staff access is through IAM Identity Center with MFA and scoped permission sets. CI authenticates
through GitHub OIDC federation. **No individual IAM users and no long-lived access keys exist
anywhere** — an organisation-wide Service Control Policy denies their creation.

---

## 5. Resilience

| Failure | What happens | Data loss | Recovery |
|---|---|---|---|
| One availability zone fails | Every tier already runs in two. Traffic shifts automatically | None | Minutes, automatic |
| Bad deploy or operator error | Roll back in seconds; restore the database to any point in the last 7 days | ≤ 5 minutes | ≤ 2 hours |
| Entire region fails | Rebuild from the same CDK code in `us-west-2` using daily backup copies | Up to 24 hours | ≤ 4 hours |

Target availability is **99.5% monthly**. The platform is designed for more; the target is set
conservatively and stated honestly.

**Graceful degradation is a design requirement, not a hope.** A job-provider outage degrades job
search only. An AI-provider outage pauses generation — queued jobs retried, status banner shown —
while the rest of the product keeps working.

---

## 6. What is deliberately not here

- **No auto-apply.** Release 2, and the position is already settled: assisted apply, not bot apply.
- **No recruiter portal, no enterprise workspaces, no bulk generation.** Every one is pre-wired in the
  data model — every workspace-scoped table carries a nullable `org_id` from day one — so they become
  a migration rather than a redesign.
- **No SMS one-time-password login.** Specified, feature-flagged off, deferred on cost and abuse
  grounds.
- **No EU-region deployment.** Documented and ready: the same CDK code deploys a fully independent
  `eu-central-1` stack with its own identity pool, database and buckets. Activated only if enterprise
  or regulatory demand requires it.
- **No Amplify Hosting** (its compute cannot join our VPC, which would force a publicly reachable
  database) and **no App Runner** (a 120-second request timeout breaks the live progress stream).
