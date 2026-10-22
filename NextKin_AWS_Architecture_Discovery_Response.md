# NextKin Apply — Response to the AWS Architecture Discovery Questionnaire

**Prepared for:** the AWS architecture team · **Date:** 2026-09-19 · **In reply to:**
*NextKin Apply — AWS Architecture Discovery Questionnaire (Pre-Architecture Review for AWS Production
Onboarding)*

---

## Summary

Thank you for the thorough questionnaire. The key points before the detailed answers:

- **Where we are.** Front-end development is at **stage 8 of 10**. Backend development is at **stage 2
  of 10** — it is currently held up because the AWS account and the domain are not yet in place. **As
  soon as AWS is ready, we continue with the backend and move on to testing.**
- **Launch markets.** We have planned for **three: the United States, Germany and Australia.** If you
  had more countries in mind, please let us know.
- **One AWS region, for now.** We have currently planned a **single region** (`us-east-1`), serving all
  three markets through CloudFront, with backup copies in `us-west-2`. **We would welcome your
  recommendation on this.** Whether compute later runs closer to each launch country will depend on
  demand.
- **Web and mobile launch together.** Both the web app and the mobile app go live at the same time. The
  mobile app is simply built second during development — its launch does not wait on any demand check.
- **The architecture is already drafted.** Each AWS service in our specification was chosen from
  requirements, constraints and failure modes, with the alternatives and the reasons for rejecting them
  recorded. **We would value your review and challenge of it** — it is summarised on one page in §0.
- **Nothing to migrate.** The codebase has no dependency on Vercel, Supabase, Inngest or Razorpay — we
  checked every package manifest and source file. The backend and the AWS platform are greenfield.

### How to read the answers

| Label | Meaning |
|---|---|
| **Confirmed** | Fixed by our project specification, or already decided |
| **Proposed** | Our recommendation — open to your review and challenge |
| **Verified 2026-09-19** | Checked against a live AWS or vendor source on that date (we ran an 18-point fact-verification sweep before replying) |
| **TBD** | Not yet decided. Recorded as an explicit assumption with an owner, as you suggested |

Supporting documents — the project specification (§7–§17), the architecture decision record (decisions
D1–D15), the implementation plan (milestones M0–M6), the verified cost model and the fact-verification
sweep — are internal and **available on request.**

---

## 0. The target architecture in one page

| Concern | Choice | Rejected alternatives (reason) |
|---|---|---|
| **Region** | `us-east-1` primary, two AZs · `us-west-2` for backup copies only · **your recommendation welcome** | Multi-region active/active (cost and complexity before demand is known) |
| **Accounts** | AWS Organization: `management`, `prod`, `nonprod`, `security` · IAM Identity Center · GitHub OIDC | Single account with tags (not a security boundary); Control Tower now (right later, not yet) |
| **Edge** | CloudFront + AWS WAF → **internal** ALB via **VPC origin**. Nothing of ours has a public IP | Public ALB; third-party CDN |
| **Compute** | **ECS Fargate, arm64.** One image, two entrypoints: `web` (Next.js API, min 2 / max 8) and `worker` (AI pipeline, min 1 / max 6, scales on queue backlog) · plus a one-off `migrate` task | EC2 (ops burden); Lambda/OpenNext (SSE, VPC, Chromium); Amplify (cannot join a VPC); App Runner (120 s timeout breaks SSE) |
| **Async** | **SQS FIFO** × 3 (`generation-priority`, `generation-standard`, `maintenance`) + DLQs · EventBridge Scheduler for cron | Step Functions (reserved for Release 2 bulk generation); Inngest/Temporal (non-AWS control plane) |
| **Database** | **Aurora PostgreSQL Serverless v2**, PostgreSQL **17** · Row-Level Security on every user-owned table · no RDS Proxy | Supabase / hosted-Postgres vendors (a separate vendor holding all PII outside our account boundary, audit trail and keys); RDS Multi-AZ (slower failover, no scale-to-zero for non-prod); DynamoDB (data is deeply relational) |
| **Identity** | **Amazon Cognito**, two pools: `users` (Essentials) and `admins` (MFA required) · server-side sessions | Hand-built auth on PostgreSQL (the original vendor quote's implication); Supabase Auth (identity held by a separate vendor); Clerk/Auth0 (extra subprocessor holding identity) |
| **Documents** | **S3**, five buckets, SSE-KMS (CMK) · presigned POST direct from device · GuardDuty Malware Protection gates every read | Uploading through the API (PII on app servers, stateful containers) |
| **Cache** | **ElastiCache Serverless for Valkey** — sessions, rate limits, idempotency keys, caches, circuit breakers, Next.js ISR cache handler | DynamoDB TTL (does not cover the breadth); in-memory (wrong with >1 task) |
| **AI** | **Claude Platform on AWS** (SigV4 via task role, no API key) → **Amazon Bedrock** (same models) → OpenAI (last resort) | Single provider; self-hosted models |
| **Payments** | **Stripe Billing + Stripe Tax** behind an internal abstraction | Razorpay (India-focused — kept as a dormant adapter) |
| **IaC / CI** | **AWS CDK (TypeScript)** in the application monorepo · `cdk-nag` · GitHub Actions with OIDC | Terraform (a second language for an all-TypeScript team) |

**Two rules shape everything:** no AI call ever runs inside an HTTP request (generation takes 45–90 s,
so it is queued and executed in checkpointed stages); and the database itself refuses to return one
user's rows to another, regardless of what the application layer does.

---

# A. Priority questions

### A1. What are the exact launch countries?

**We have planned for three: the United States, Germany and Australia.** If you had more countries in
mind, please let us know which. Each additional market can bring its own payment methods, tax
registration and privacy regime, so we would like to plan for it early.

| Question | Answer |
|---|---|
| Users located there? | Yes — the product is marketed to and priced for users in these three countries |
| Infrastructure must run there? | **Not at launch.** We have currently planned one AWS region (`us-east-1`); German and Australian users are served through CloudFront edge locations in Frankfurt and Sydney, which terminate the connection close to the user. **Whether compute runs in or near each launch country will depend on demand** — and we would welcome your recommendation |
| Data must remain there? | **No.** All launch data lives in the US (see A6) |
| Localised for those markets? | Yes — local currency pricing (USD / EUR incl. VAT / AUD incl. GST), local payment methods (SEPA Direct Debit in Germany), market-specific visa/work-authorisation fields, and German consumer-law requirements in checkout |

Beyond these three, India, the UK and Canada are candidate future markets.

### A2. Why AWS?

**Confirmed: it is the client's decision**, and our specification was written to it. The reasons it
holds up on its merits:

- **Every component we need is a first-party managed AWS service** — one bill, one IAM model, one audit
  trail (CloudTrail), one support contract.
- **AI inference is billed through AWS too.** Claude Platform on AWS and Bedrock both appear on the AWS
  invoice, so the largest variable cost sits beside everything else.
- **This product is concentrated PII** — employment history, contact details, sometimes visa status.
  A split stack (Vercel + Supabase + Inngest) would put that data across four vendors, four security
  reviews and four DPAs. Consolidating is simpler to secure and to explain.
- **Enterprise and partnership channels** (a roadmap recruiter portal and enterprise workspaces) need
  answers to security and residency questionnaires. AWS makes those answerable without re-platforming,
  including a documented `eu-central-1` deployment if a customer requires EU residency.

We did compare objectively. Our specification carries an "available choices" table for each layer
(Inngest is compared directly as the job layer), and our architecture decision record covers Vercel as
a platform-as-a-service, a Vercel + Supabase + queue-vendor split stack, and Supabase as hosted
PostgreSQL — recording why each was not chosen.

### A3. What is the current implementation status?

**Front end: stage 8 of 10. Backend: stage 2 of 10** — held up because the AWS account and the domain
are not yet in place.

| Component | Status |
|---|---|
| Web app (`apps/web`, Next.js 16, App Router) | **Stage 8 of 10.** Runs end to end on a mock data layer. Already configured for containers: `output: 'standalone'` and `compress: false` (so SSE streams are not buffered) |
| Mobile app (`apps/mobile`, Expo SDK 57) | Built on the same mock data layer. **Launches together with the web app** |
| Shared data layer (`packages/shared`) | Built. Defines the full typed API contract — 11 repository interfaces, 98 methods — that the real backend will implement, for both apps |
| Backend API, worker, database | **Stage 2 of 10.** Architecture and implementation plan complete; build waiting on AWS and the domain |
| AWS | **Nothing provisioned yet** |

**Repository:** a pnpm monorepo on GitHub (`apps/*`, `packages/*`), Node 22, TypeScript strict.

**Dependencies on Vercel, Supabase or Inngest: none.** We checked every `package.json` and every source
file. There is no API route, no server action, no database client and no network call anywhere yet —
so there is nothing to unwind.

### A4. What AWS foundation already exists?

**None.** No Organization, accounts, Control Tower, Identity Center, VPC, Route 53 zone, CloudTrail,
GuardDuty, Security Hub, logging, budgets, KMS standards or GitHub–AWS integration. The domain has not
been purchased yet either.

**Proposed sequencing — agreed with the client: AWS first.** We will not build the whole platform
before writing application code; we will set up the minimum that unblocks everything else, in this
order:

1. Purchase the domain (it blocks SES, the Cognito custom domain and the Google sign-in review)
2. Open the AWS Organization and accounts, apply guardrails, set up Identity Center and GitHub OIDC
3. Stand up one `dev` environment
4. File the external approvals (SES production access, Google OAuth verification, Apple, Claude
   Platform on AWS, Bedrock access)

**As soon as this is ready, backend development continues and moves on to testing.** Production
hardening, WAF tuning, DR drills and load testing follow later, in their planned place.

### A5. Expected user and workload scale

**Confirmed first-year design envelope** (specification §8.3 and §9.15); **per-milestone figures are
TBD.**

| Metric | First-year planning envelope |
|---|---|
| Registered users | Tens of thousands |
| MAU | ~10,000–20,000 |
| DAU | ~1,000–3,000 |
| Full resume generations | Planning scenarios of **10K / 30K / 60K per month**; 30K is the central case |
| Burst | e.g. **500 generations in 5 minutes** — a required load test (Sunday-evening job-hunt spikes) |
| Concurrent live-progress streams | **200+ for 30 minutes** — a required soak test |
| Per-user concurrency | Capped at **2 concurrent generations** |

**TBD (owner: client):** launch vs 6-month vs 12-month breakdown, API requests per second, uploads and
job searches per day, and assistant message volume. We will convert these into explicit assumptions
once product analytics exist from the closed beta.

### A6. Data residency rules for PII

**Confirmed: all Release 1 data is stored in the United States.** EU users' data is transferred under
the EU–US Data Privacy Framework where the recipient is certified, and Standard Contractual Clauses
with a transfer impact assessment otherwise, with a DPA with every subprocessor. We design to the
strictest of the three regimes — **GDPR** — for every user, regardless of country.

| Data class | Location |
|---|---|
| Profiles, resumes, visa fields, chat history, generated documents (Aurora, S3) | `us-east-1` |
| Sessions and caches (Valkey), identities (Cognito), logs | `us-east-1` |
| Backups | `us-west-2` (cross-region copies) |
| Edge (CloudFront) | Global — **public pages and static assets only; no PII is cached at the edge** |
| Payment card data | Stripe only — never touches our systems (PCI SAQ A) |
| AI processing | See below — **this is the one area needing a decision** |

**Contact details (email, phone, address) are never sent to any AI provider.** They are merged into
documents at render time. Each pipeline stage receives only the fields it needs.

> **A finding from our verification sweep that the specification did not anticipate.** The spec assumed
> that a US-region Claude Platform workspace meant US-located inference. **Verified 2026-09-19, that is
> not how it works:** the workspace region controls the gateway endpoint, while inference geography is
> set **per request** (default `global`; pinning to `us` costs 1.1×, and is **not supported on Haiku
> 4.5**). Separately, **zero data retention is not a workspace toggle** — it is available on request
> from Anthropic, per organisation. On Bedrock in `us-east-1`, the standard runtime offers only US-geo or
> global cross-region profiles; single-region inference requires the separate Messages-API endpoint.
>
> **TBD (owner: client + counsel):** whether AI inference must be pinned to the US. If yes, it costs
> ~10% more on inference and constrains which model can run the high-volume extraction stages. We would
> value your view on the cleanest way to configure this.

**Anonymous "try before signup" uploads** are held in a separate bucket and **hard-deleted at 24
hours**. Self-service data export and account deletion (purge within 30 days) are built in.

### A7. English-only or multilingual?

| Aspect | Answer |
|---|---|
| UI languages | **Confirmed: English at launch.** The codebase uses a locale-aware formatting layer (dates, USD/EUR/AUD), so a German UI is a content task, not a refactor |
| Resume, JD and AI-generation languages | **TBD (owner: client).** The specification does not scope German-language resume generation. Names with German characters (ä, ö, ü, ß) are explicitly tested |
| Job listings | Whatever language the provider returns for each country endpoint |

### A8. Monthly operating budget

**These are estimates from our cost model, re-verified against live AWS price lists on 2026-09-19. A
formal approved budget ceiling has not been set (TBD, owner: client).**

| Line | Low | Typical | High | Notes |
|---|---|---|---|---|
| AWS production | $405 | **$765** | $1,610 | Multi-AZ, private networking, full security baseline |
| AWS non-production (dev, staging, previews) | $165 | **$330** | $590 | Aurora scale-to-zero, Fargate Spot |
| **AWS total** | **$565** | **$1,095** | **$2,200** | Before startup credits, which we will apply for |
| Error tracking (Sentry) | $26 | $40 | $80 | Non-AWS |
| Job APIs | **To be decided based on budget — needs a stakeholder meeting.** Candidates: Adzuna (free tier, negotiable) · JSearch (from ~$25/month for 10K requests) | | | |
| Payments | Stripe percentage fees; Stripe Tax on top | | | |

**AI tokens are the larger number once there are users:**

| Generation-tier model (verified prices) | Per generation (with caching) | 10K gens/mo | 30K gens/mo | 60K gens/mo |
|---|---|---|---|---|
| Sonnet-class — `claude-sonnet-5`, $2 / $10 per M tokens | ≈ $0.11 | ≈ $1.1K | ≈ $3.4K | ≈ $6.8K |
| Opus-class — `claude-opus-5`, $5 / $25 per M tokens | ≈ $0.28 | ≈ $2.8K | ≈ $8.5K | ≈ $16.9K |

Two caveats we want to be upfront about: the newer models' tokenizer produces **roughly 30% more
tokens** for the same text than our estimates assumed, so AI figures may be low until measured; and
**which model writes the resume moves more money than every infrastructure decision combined.** That
choice will be made on evaluation evidence against a golden test set, not by default.

### A9. Target beta and production launch date

**TBD (owner: client).** No calendar date has been set.

- **As soon as AWS is ready, we continue with the backend and move on to testing.** The AWS account and
  the domain are the current blockers.
- **Rollout: all three markets together**, not country by country, and **the web app and the mobile
  app launch at the same time.** The closed beta (25–50 real job seekers) deliberately spans all three
  markets and all four user personas.
- **Lead times that cannot be compressed:** Google OAuth consent verification (1–4 weeks, blocked on the
  domain), and German VAT / Australian GST registration (weeks).

### A10. Must the solution be AWS-native wherever practical?

**Confirmed: yes, with four deliberate, documented exceptions**, each behind an internal abstraction so
it can be swapped without a rewrite:

| Service | Why it stays | Abstraction |
|---|---|---|
| **Claude Platform on AWS** (Anthropic-operated) | Same-day feature parity with the first-party API, including Message Batches at 50% off; billed via AWS Marketplace; SigV4 auth with no key | `LLMProvider` — Bedrock is the same-model fallback |
| **OpenAI** | Last-resort AI fallback only | `LLMProvider` |
| **Stripe** | Card data never touches our systems; handles DE VAT and AU GST | `PaymentProvider` |
| **Job listing providers** (candidates: Adzuna, JSearch) | No AWS equivalent for job listings. **Final selection depends on budget and needs a stakeholder meeting** | `JobProvider` |
| **Sentry** | Error tracking (CloudWatch RUM is the AWS-native alternative) | — |

**Vercel, Supabase and Inngest are not part of the design.**

---

# B. Detailed answers

## 1. Product scope and launch

| Question | Answer |
|---|---|
| Mandatory vs deferrable launch capabilities | **Confirmed.** Never deferred: AI generation pipeline, Timeline Validation Engine, ATS scoring, security baseline. **Pre-agreed de-scope levers, in order:** one job provider instead of two · defer Skills Explorer · defer AI assistant · defer interview questions · 2–3 templates instead of 3–5 · one cover-letter tone · no Aurora reader and a single NAT gateway · no per-PR preview environments. Removing whole modules needs client sign-off |
| Native mobile at launch? | **Yes — the web app and the native mobile app (React Native / Expo) launch together.** Mobile is built second during development; that is sequencing only, not a demand gate. Both apps use the same API and the same shared data layer. Web authenticates with a server-side session behind an opaque cookie; mobile sends Cognito access tokens, verified against the pool's JWKS on every request. Live generation progress reaches mobile over SSE, with polling as the fallback |
| Admin Portal: same deployment or isolated? | **Confirmed: same application and deployment**, but isolated by identity and at the edge — a separate Cognito pool with **MFA required**, a stricter WAF rule group on `/admin/*`, server-side RBAC (Super Admin / Admin / Content Curator / Support), and every admin mutation written to an append-only audit log exported nightly to S3 Object Lock. **We would welcome your view** on whether separate deployment is warranted at this scale |
| Same features in all countries on day one? | **Confirmed: yes** |
| Country-specific variations | Pricing and currency (USD / EUR incl. VAT / AUD incl. GST) · payment methods (SEPA Direct Debit in Germany) · German checkout requirements (14-day withdrawal right, online cancellation button) · visa/work-authorisation lists per market · job-provider country endpoints. **German resume conventions (photo, date of birth, marital status) are deliberately not collected** — data minimisation, and our templates are ATS-safe |
| Business owner who approves scope and trade-offs | **TBD (owner: client)** |

## 2. Traffic, capacity and growth

| Question | Answer |
|---|---|
| Users, MAU, DAU, peak concurrency | See A5. Launch / 6-month / 12-month split **TBD** |
| Average and peak API RPS | **TBD.** Planning assumption: low at launch; the `web` tier runs 2–8 tasks with target tracking on CPU (60%) and requests per target |
| Parsing jobs per day and at peak | **TBD** |
| Full generations per day and peak per minute | Scenarios of 10K / 30K / 60K per month; the required burst test is **500 in 5 minutes** |
| Country traffic distribution | **TBD.** The US is assumed to be the largest market, which is one reason for `us-east-1` |
| Predictable spikes | **Sunday evenings** (weekly job-hunting peak) are the design case. Others (campaigns, layoffs, graduate recruiting cycles) TBD. **The queue absorbs bursts** — a spike makes the queue longer, not the site slower |
| 10× growth | No architectural rework needed: raise task maximums, add Aurora readers, split the worker per queue, raise AI throughput quotas — all CDK configuration. **The binding constraint at 10× is AI provider throughput quota**, not compute; worker maximum is sized to it. Response time for a 10× event: TBD |

## 3. Global architecture and data residency

| Question | Answer |
|---|---|
| Compute in each launch country? | **Depends on demand.** At launch we have planned one region (`us-east-1`), with CloudFront edge termination in Frankfurt and Sydney; German and Australian users add ~90–150 ms of round trip, which the latency targets already account for. If demand in a market justifies it, the same CDK code can deploy additional regional stacks. **We would welcome your recommendation** |
| Data classes stored centrally vs locally | **All stored centrally in `us-east-1`.** No class is country-local in Release 1 |
| Backups crossing borders? | **Yes** — daily copies to `us-west-2`, encrypted with multi-region KMS keys |
| AI processing in a different location from the user? | **Yes, under current terms** — see the A6 finding on inference geography and retention. **TBD** whether US-pinned inference is required |
| Home region per user? | Not needed in Release 1. **Documented option:** a fully independent `eu-central-1` deployment from the same CDK code (own Cognito pool, Aurora, buckets), with users homed to a region at signup, if an enterprise customer or regulator requires EU residency. **Verified 2026-09-19:** Cognito, Aurora Serverless v2 (PG 17.4+) and Claude Platform are all available in `eu-central-1` |
| Single profile if a user moves country? | **Yes** — one account and profile, independent of the user's country |
| Deletion, export, consent, subprocessor rules by country | Self-service export (GDPR Art. 20, Australian APP 12) and self-service deletion within 30 days, for every user. Privacy policy in **English and German**. Subprocessor register naming AWS, Anthropic, OpenAI, Stripe and the job providers with processing locations. Analytics under legitimate interest with opt-out; marketing email by consent only |

## 4. AWS Organization, accounts and governance

| Question | Answer |
|---|---|
| Who owns the payer/management account? | **TBD (owner: client)** |
| Separate dev / staging / prod accounts? | **Confirmed: `prod` and `nonprod` accounts are separate.** `dev`, `staging` and per-PR previews share `nonprod`. **Proposed:** a dedicated `security` account |
| Security / log-archive / shared-services accounts | **Proposed:** one `security` account receiving CloudTrail from all accounts. Full Control Tower landing zone (log archive, audit) is the documented upgrade when SOC 2 or enterprise contracts arrive |
| Console, CLI and production deploy access | **TBD (owner: client)** for named people. **Confirmed model:** Identity Center with MFA; engineers admin in `nonprod` and **power user (not admin) in `prod`**; production deploys only through the pipeline, which cannot read production data |
| Identity Center, and which workforce IdP | **Confirmed:** Identity Center. Backing IdP **TBD (owner: client)** |
| Tagging standard | **Confirmed:** `env`, `service`, `component`, `owner` — enforced by SCP. **Open to adding** cost-center and data-classification tags if you recommend them |
| Budget thresholds and anomaly alerts | **Confirmed:** AWS Budgets per account at 50 / 80 / 100% of forecast; Cost Anomaly Detection at **$50/day** |
| SCPs and guardrails | **Confirmed, from day one:** deny leaving the Organization; deny disabling CloudTrail, GuardDuty or Security Hub; **deny creating IAM user access keys**; restrict to approved regions; require cost tags |

## 5. Networking and edge

| Question | Answer |
|---|---|
| Private VPC networking? | **Confirmed: yes.** Tasks in private subnets; Aurora and Valkey in **isolated subnets with no internet route** |
| Workloads with no direct internet access | Database, cache and the parsing path. Workers reach AI and job APIs only via NAT |
| Outbound internet needs | Claude Platform on AWS, OpenAI (fallback), Adzuna, JSearch, Stripe API, Sentry. **S3 traffic uses a gateway endpoint** and never crosses NAT |
| Fixed outbound IP needed? | **Not known to be required.** The single NAT gateway provides a stable egress IP if a provider asks for allowlisting |
| WAF requirements | **Confirmed:** AWS managed rule sets; rate-based rules on auth, AI, teaser and job-search routes; **Challenge** action on anonymous endpoints (they cost us AI money); stricter rules on `/admin/*`; **payment webhooks excluded** from rate rules (signature verification is the control). Geo restriction: not required. Bot Control: optional (the cost model's "high" band) |
| Domains | **Domain not yet purchased (TBD).** Planned: the apex for the app, API and admin (one distribution); `auth.<domain>` for Cognito; `mail.<domain>` for SES. **Open decision:** whether the app sits at the apex or `app.<domain>` — it affects cookie scope |
| Single global CloudFront distribution? | **Confirmed: yes**, one per environment. Route-class behaviours: immutable static; `stale-while-revalidate` public pages; `private, no-store` authenticated routes; **SSE with caching and compression disabled** |
| VPN / Direct Connect / customer VPC | **Not in scope** |

## 6. Application runtime and compute

| Question | Answer |
|---|---|
| Can Next.js run as a container? | **Confirmed: yes.** Already set to `output: 'standalone'`. No Vercel-specific runtime features are used |
| SSR / ISR / streaming / SSE / WebSockets / edge | SSR for the app; **ISR for public Skills Explorer pages**, with the Next.js cache handler on Valkey so all tasks share one cache; **SSE** for generation progress and assistant token streaming; **no WebSockets; no edge execution** |
| Longest synchronous request | CRUD targets: **< 300 ms reads / < 500 ms writes (p95)**. SSE streams are long-lived by design — 15 s heartbeats, the server closes at ~5 minutes and the client reconnects with `Last-Event-ID` |
| CPU/memory-heavy jobs | **Headless Chromium** PDF rendering (worker sized at 2 GB) · OCR is offloaded to **Textract** · LLM calls are I/O-bound |
| Independent worker scaling? | **Confirmed: yes** — scales on **SQS backlog per task**, minimum one warm task |
| GPU? | **No** |
| Deployment model preference | **Confirmed: containers** (ECS Fargate). Lambda only for Cognito triggers and the S3 malware-scan glue — no product logic in Lambda |
| Cold starts and scale-out | Always-warm minimums (2 web, 1 worker); **Aurora scale-to-zero disabled in production** because a ~15 s resume is unacceptable on a user request. Worker scale-out must react within ~2 minutes |

## 7. Asynchronous AI pipeline

| Question | Answer |
|---|---|
| Pipeline and retryable stages | **Seven stages, each independently retryable:** extract JD → compare profile → generate resume → **validate timeline (deterministic code, no AI)** → score → cover letter → persist. The message is only `{generation_id}`; all state lives in PostgreSQL |
| Maximum duration per stage | Whole-pipeline targets: **p50 < 45 s, p95 < 90 s**. Per-stage budgets **TBD** — measured once the evaluation harness runs |
| Per-user concurrency cap | **2**, via SQS FIFO message group ID `user_id#slot` |
| Retry, backoff, DLQ, idempotency | In-stage retry with exponential backoff and capped attempts; failover to the next AI provider at stage granularity; DLQ after `maxReceiveCount` with **alarms on both depth and oldest-message age**; `Idempotency-Key` required on quota-consuming creates, held 24 h |
| Parallel or sequential? | **Sequential** — each stage consumes the previous one's output |
| State that must survive failures | After every stage, `current_stage`, `attempt` and `checkpoint` are written **in one transaction**. A redelivered message resumes at the first incomplete stage; visibility timeout is extended by heartbeat during long LLM calls. **Queued work survives an AZ failure** (SQS); a region loss is covered by the DR plan |
| How long can work wait? | **≥ 99% of jobs must reach a terminal state within 3 minutes**; anything exceeding that is auto-failed with a visible retry, never left spinning |
| Safe to replay without duplicate side effects | **All stages are idempotent.** Crucially, **quota is charged on completion, not on enqueue** — a retry can never double-charge a user. Resume versions are immutable and written once per generation |

## 8. AI / LLM strategy

| Question | Answer |
|---|---|
| Claude primary, OpenAI fallback, Bedrock? | **Confirmed chain:** Claude Platform on AWS → **Amazon Bedrock** (same models, so quality is preserved) → OpenAI. **Verified 2026-09-19:** Opus 5, Sonnet 5 and Haiku 4.5 are all available on both paths |
| Model families per stage | **Fast tier** (`claude-haiku-4-5`): parsing, JD extraction, keyword sub-scoring, assistant topic classifier. **Generation tier** (`claude-opus-5` or `claude-sonnet-5` — decided on eval evidence): profile comparison, resume writing, cover letters, interview questions, assistant replies. **Timeline validation uses no model at all.** Model IDs are configuration, not code |
| Tokens per stage | Planning estimates per full generation: **~30–47K input / ~8–10.5K output** across all stages. Likely **~30% low** for the newer tokenizer — to be measured |
| Free and paid quotas | Free: **3 full generations / month**, 3 standalone ATS checks, 1 cover letter, capped assistant messages per day. Pro: a **published** fair-use cap (e.g. 100 generations / month) with a visible usage meter. Being re-derived from the verified prices |
| Rate limits / committed throughput | **None yet** (nothing provisioned). Quota increases for both AI endpoints will be requested with load-test evidence before launch. **We would value your guidance** on Claude Platform and Bedrock throughput quota processes |
| PII prohibited from prompts | **Email, phone and postal address — always.** Each stage gets only the fields it needs. Payment data never reaches the AI layer |
| Retention / no-training terms | Bedrock: no retention, no training, **invocation logging disabled.** OpenAI: no-training API terms. Claude Platform: **zero data retention must be requested from Anthropic per organisation** (verified — not a workspace setting). All three in the subprocessor register |
| Fallback when primary is down | Automatic stage-level failover to Bedrock (prompt cache starts cold — accepted cost), then OpenAI. Fallback use is recorded per generation and a sustained fallback rate alarms. If every provider fails, generation pauses with a status banner and queued jobs retry — the rest of the product keeps working |
| Recording prompts, models, tokens, latency, cost | **Every AI call** records provider, endpoint, model, prompt template ID and version, tokens in/out, cache read/write tokens, latency, cost and outcome (success / refusal / error), linked to the job and a correlation ID. Every generation stores the exact prompt version and knowledge-base version used |
| Quality gate before production | **An evaluation harness over 30–50 golden profile + JD pairs**, including deliberately trap-laden cases. Any prompt, model or routing change triggers a full run. **Release is blocked** if the aggregate score drops below the bar or **any timeline-validation violation occurs** (zero tolerance). Admin prompt edits cannot be published without a passing run |

## 9. Database and data model

| Question | Answer |
|---|---|
| Size at launch and after one year | Planning figure **20–50 GB** in the first year (from the cost model). **TBD** — to be measured |
| Largest / fastest-growing tables | `resume_versions` (immutable; every edit is a new version), `generations` (per-stage logs), `chat_messages`, `audit_logs` (append-only) |
| Read/write ratio and peak connections | **TBD.** Read-heavy. Connection pools are sized against Aurora's ACU-dependent limit; **no RDS Proxy** — it adds a ~$88/month floor and can pin sessions on `SET`, which conflicts with our per-transaction RLS variable |
| PostgreSQL mandatory? | **Confirmed: yes.** Pinned to major version **17** (verified 2026-09-19: 17.4+ is orderable on Serverless v2 in `us-east-1`; scale-to-zero, which non-production relies on, needs 16.3 or later) |
| Full-text / vector search / embeddings at launch? | **No** vector search or embeddings. Library search over titles and companies is modest and fits PostgreSQL |
| Analytics against the transactional DB? | Release 1 admin analytics are **aggregate-only** on the transactional database, with cache-first read paths for heavy public reads. A separate analytics store is a Release 2 question |
| Organisation/workspace fields from day one? | **Confirmed: yes.** Every workspace-scoped table carries a **nullable `org_id`**, and every RLS policy is written org-aware but dormant. Enterprise workspaces then become a migration, not a redesign |
| Consistency guarantees | Strong (single writer) for generation status, **quota counters (atomic — two concurrent generations cannot race past a cap)**, subscriptions and entitlements. Entitlements are read from **our** tables, never from Stripe live |
| Migration tooling | **Proposed:** versioned SQL migrations run by a one-off `migrate` ECS task **as the owner role**, forward-only, **expand/contract** so blue/green versions can overlap. ORM/tool choice TBD (Drizzle or `node-postgres` suit the transaction-scoped RLS pattern) |
| Backup, PITR, restore testing | **7-day PITR** (extendable to 35) · snapshot before every production migration · daily cross-region copies · **restore drill before launch and quarterly**, with measured recovery time written down |

## 10. Authentication and authorisation

| Question | Answer |
|---|---|
| Existing users to migrate? | **None.** Pre-launch — no production users exist |
| Login methods at launch | **Email/password** (SRP, from our own UI — not a hosted page), **Google** and **Apple** (Cognito federation, Authorization Code + PKCE). **SMS OTP is deferred** (feature-flagged off; would use AWS End User Messaging — Pinpoint reaches end of support on 2026-10-30). No magic link |
| MFA | **Required for admins** (separate pool). Not required for users in Release 1 |
| Roles now and later | Now: `user`, `admin` — with admin sub-roles Super Admin, Admin, Content Curator, Support. Later: `recruiter` is additive (Cognito group) |
| Granting and revoking admin privileges | Cognito groups in the admin pool; role changes are **Super-Admin-only** and audited |
| Supabase Auth or migrate? | **Not applicable** — Supabase is not in the design. **Cognito** is chosen |
| Global session revocation | Sessions are **server-side in Valkey** behind an opaque cookie. Logout deletes the session and calls `RevokeToken`; "sign out everywhere" deletes all of a user's sessions and calls `GlobalSignOut`. **The next API call with an old cookie returns 401 immediately.** Password change invalidates all sessions |
| Account linking / duplicate identities | **Yes, expected.** A Pre sign-up Lambda uses `AdminLinkProviderForUser` and handles **both orderings** (password-first then Google, and the reverse), tested explicitly |

## 11. File storage, uploads and document security

| Question | Answer |
|---|---|
| Average and maximum upload size | **TBD — the value.** The specification requires an enforced limit (via presigned-POST policy conditions) but does not fix the number; set at the first auth/profile milestone |
| Accepted types | **PDF, DOCX, TXT.** File type is sniffed, never trusted from the extension |
| Retention | Uploads: kept with the account. Exports: deleted with their resume version. Resume versions: **last 3 per resume on Free, extended (e.g. 20) on Pro** — older versions are locked, not deleted, on downgrade. All purged within 30 days of account deletion |
| Versions per resume/user | See above; each save or regeneration creates a new immutable version |
| Recovery window before deletion? | **Yes — 30-day trash**, then purged by a scheduled job, **deleting S3 objects by reference** rather than by blind lifecycle rule |
| Malware scanning of every upload? | **Confirmed: yes.** GuardDuty Malware Protection for S3. The bucket policy **denies `s3:GetObject` on any object lacking the clean-scan tag** (verified tag key and values 2026-09-19), and the scan-result event is what releases the parse job |
| Isolated parsing? | Parsing runs in the `worker` service, which has **no inbound network access** and a least-privilege task role, and only after the scan passes. Inputs are treated as untrusted, including against prompt injection |
| Per-user prefixes / buckets; anonymous bucket | **Per-user prefixes** (`users/<user_id>/…`) in shared buckets. **Separate `anonymous-uploads` bucket**, hard-deleted at 24 hours |
| Legal hold | **Not a stated requirement.** The audit-log archive uses S3 Object Lock (compliance mode, 12+ months) |
| Signed-URL lifetimes | Upload: **minutes.** Download: **≤ 15 minutes** |

## 12. Parsing, OCR and document rendering

| Question | Answer |
|---|---|
| OCR solution | **Amazon Textract** (async text detection), only for scanned PDFs with no text layer. Verified price 2026-09-19: $0.0015 / page |
| % scanned resumes | **TBD** — measured from the parser test corpus |
| OCR languages | English and German (Latin script with ä, ö, ü, ß). **TBD** beyond that |
| Complex layouts, non-Latin scripts | Multi-column resumes and tables are in scope for parsing (extracted by LLM into a strict schema). Non-Latin scripts not scoped for Release 1 |
| Parsing accuracy threshold | **Batch-tested against 50–100 real resumes** with a quality bar on dated roles, skills and education; exact threshold **TBD**. A deterministic check compares extracted dates and employer names against the source text, and **nothing enters the profile until the user confirms it** |
| Headless Chromium confirmed? | **Confirmed.** Same HTML/CSS as the on-screen preview, a warm browser reused across jobs, bundled metric-compatible fonts. Output is real selectable text in reading order |
| Export sizes and rates | Target **< 10 s per render**. Volume **TBD**, proportional to generations |
| Rendering isolated from web/API? | **Confirmed: yes** — rendering runs only in the `worker`. The browser receives a presigned URL, never a streamed file |

## 13. Job aggregation

> **Provider selection is not final.** Which job providers we use will be decided **based on budget**,
> and needs a **meeting with stakeholders**. The answers below describe our current candidates, Adzuna
> and JSearch. Whatever is chosen sits behind one internal adapter interface, so the rest of the product
> is unaffected by the decision.

| Question | Answer |
|---|---|
| Adzuna + JSearch coverage for the launch countries? | **Yes for all three**, if selected. Adzuna has country endpoints for `us`, `de` and `au`; JSearch supplies full descriptions and salary data |
| Keys and contracts in place? | **Not yet** — follows the budget decision and stakeholder meeting |
| Quotas, attribution, caching limits | Adzuna free defaults: 25 req/min, 250/day, 1,000/week, 2,500/month (negotiable). Mandatory "Jobs by Adzuna" attribution; **no storage beyond display**, so we cache only normalised metadata for 24–72 h. JSearch from ~$25/month for 10K requests. **Both re-confirmed at key registration** — our sweep could not machine-read the current quota pages |
| Authoritative provider on duplicates | Dedup on canonical apply-URL hash plus fuzzy title + company + city; **the richer record with the employer-direct link wins** |
| Acceptable cache TTL | 24–72 hours, per provider terms |
| If providers fail | **Search degrades, it does not fail.** Per-provider circuit breakers in Valkey; one provider down means fewer results; all down means job search shows an error state while every other feature keeps working |
| Country-specific providers at launch? | **No.** Jooble and Careerjet are post-launch candidates |
| Employer-direct links preferred? | **Yes**, in all markets — subject to Adzuna's tracked-redirect requirement for its own listings |

> A transparency note: **JSearch aggregates Google for Jobs, which Google's terms prohibit.** We treat it
> as a swappable dependency with breakage risk and never describe it to users as an official source. The
> adapter pattern is exactly why.

## 14. Payments, pricing and entitlements

| Question | Answer |
|---|---|
| Approved providers | **Stripe Billing + Stripe Tax** for all three countries. **Verified 2026-09-19:** Stripe Tax covers Germany and Australia. Merchant-of-record (Stripe Managed Payments exists) is the documented alternative |
| Currencies | **USD, EUR, AUD** |
| Localised or converted? | **Localised** — set near purchasing-power parity, tax-inclusive in DE and AU, validated during beta |
| Monthly and annual? | **Yes** — Free, Pro Monthly (~$19 / €19 / A$29), Pro Annual (~$99–119 / €99–119 / A$149–179). Indicative bands, finalised at beta. Pause-subscription (1–3 months) supported |
| Tiers and entitlements | Free and Pro (monthly/annual). Free: 3 generations, 3 ATS checks, 1 cover letter per month, **clean watermark-free PDF export, unlimited**, no DOCX, 10 saved jobs, last 3 versions. Pro: published fair-use caps, DOCX, full templates, priority generation queue. **All limits are published and shown on a live meter** |
| VAT, GST, sales tax, invoices | Stripe Tax calculates and collects; NextKin remains seller of record and files returns (or uses a filing service) — **TBD (owner: client + accountant)**, or switch to merchant of record. Compliant invoices and receipts emailed for every charge |
| Failed payments, grace periods, cancellation, refunds | Subscription lifecycle `trialing → active → past_due → canceled`. Self-serve cancellation effective at period end, German online cancellation button, **14-day withdrawal right honoured**. Dunning and grace period use Stripe's primitives — exact grace window **TBD** |
| Webhooks exactly once? | **Confirmed:** verify signature → **persist the event** → process **idempotently by provider event ID**. A slow handler can never double-charge or double-upgrade |
| Payment operations in the gateway console? | **Yes** — refunds and disputes link out to Stripe. The admin portal views subscription state and grants comped access / quota top-ups |

## 15. Availability, resilience, backup and DR

| Question | Answer |
|---|---|
| 99.5% accepted? | **The specification's target is 99.5% monthly.** Business acceptance **TBD (owner: client).** 99.9% is a documented upgrade (+~$77/month: a second NAT gateway and an always-on Aurora reader) — to be decided before hardening |
| RTO / RPO | **AZ failure:** RPO 0, RTO minutes, automatic. **Bad deploy / operator error:** RPO ≤ 5 min, RTO ≤ 2 h. **Region loss:** RPO ≤ 24 h, RTO ≤ 4 h |
| Tolerate a task failure? | **Yes, automatically** |
| Tolerate an AZ failure? | **Yes.** Every tier spans two AZs. One accepted gap: the **single NAT gateway** means outbound calls (AI, job APIs) degrade if that AZ fails — consistent with 99.5% |
| Tolerate a region failure? | **Via scripted rebuild in `us-west-2`**, not live failover |
| Active/passive or active/active? | **Backup-and-restore (active/passive, cold)** for Release 1. Aurora Global Database (RPO in seconds) is the documented upgrade at roughly double the database cost |
| Restore / DR test frequency | **Before launch and quarterly**, with the measured RTO written down. Plus an AZ-failure game day and a deliberately failing release to prove automatic rollback |
| Independent degradation | **Job search** degrades alone · **AI generation** pauses with a banner, queued work retries · **payments** — paying users keep features because entitlements are read from our database · **Valkey loss** signs users out but loses nothing durable · **exports** of already-rendered files keep working |
| User-facing status communication | A status page and communications plan, fed by AWS Health events. It states openly the one hard limitation: **Cognito pools cannot be replicated across regions and password hashes cannot be exported**, so after a region loss users re-authenticate via Google/Apple or reset their password |

## 16. Security and compliance

| Question | Answer |
|---|---|
| Launch compliance obligations | **GDPR** (with German BDSG), **Australian Privacy Act 1988** (APPs, including Notifiable Data Breaches), **US state privacy laws** (e.g. CCPA/CPRA). **PCI DSS: SAQ A** only (Stripe-hosted checkout). **India DPDP: not applicable** (India deferred). **SOC 2 / ISO 27001: not launch requirements** — the account baseline is ready for Control Tower and Config conformance packs when they are |
| OWASP ASVS Level 2? | **Confirmed** as the working checklist. Security is a **release gate** and excluded from de-scope levers |
| External penetration test before launch? | **Recommended before the first enterprise or partnership contract**; before public launch — **TBD (owner: client)** |
| Data classification | Resumes, profiles and visa fields: **sensitive PII**. Logs: **PII-scrubbed by default** — resume content and contact details never appear in a log line (tested). Billing metadata: stored minimally; card data never held. Formal classification policy document **TBD** |
| CMK or AWS-managed keys? | **Confirmed: customer-managed KMS keys** for Aurora, S3 (with bucket keys), SQS, CloudWatch Logs, Secrets Manager and ECS ephemeral storage |
| Key and secret rotation frequency | **Proposed:** KMS automatic key rotation enabled on every CMK (period to confirm with you). The primary AI path has **no secret** at all (IAM task role). Third-party keys live in Secrets Manager — rotation schedule **TBD**. Admin-entered provider keys are **write-only** and never redisplayed |
| Audit logging and retention | Logins and failures, role changes, PII access, key changes, every admin mutation. Retained **≥ 12 months** in PostgreSQL **plus** a nightly export to S3 **Object Lock (compliance mode)**. CloudTrail in all accounts |
| Production PII access and break-glass | **Exceptional, reasoned and audited.** Admin access to an individual user's content requires a recorded reason and is prominently audited. Named approvers and break-glass procedure **TBD (owner: client)** |
| Scanning requirements | **Confirmed:** dependency scanning, secret scanning, **Amazon Inspector on every image as a deploy gate** (critical findings block), `cdk-nag` on every infrastructure change, IAM Access Analyzer, Security Hub FSBP with no open critical/high at launch. **SBOM generation: not yet specified — open to your recommendation** |
| Incident response and breach notification | Runbook covers the **GDPR 72-hour** notification and the **Australian Notifiable Data Breaches** scheme; US state notification obligations to be confirmed by counsel |

## 17. CI/CD, IaC and release management

| Question | Answer |
|---|---|
| Source repository | **GitHub** |
| Branching / release strategy | Trunk-based: PRs into `main`; `main` deploys to `dev`; a **tag** promotes through staging to production |
| Developers and teams | **TBD (owner: client)** |
| Checks before merge | Lint, typecheck, tests against real Postgres/Valkey/MinIO/ElasticMQ containers, `cdk synth` + `cdk-nag` + assertion tests, dependency and secret scanning, a `cdk diff` comment on the PR |
| Checks before production | Inspector image gate → dev → migrate → smoke → staging → end-to-end tests → **AI quality regression** → **manual approval** → **pre-migration Aurora snapshot** → prod |
| Preview environment per PR? | **Opt-in**, label-triggered, auto-destroyed after 3 days (not every PR) |
| IaC standard | **Confirmed: AWS CDK (TypeScript)**, stacks split by concern: network, data, identity, compute, edge, async, observability, security-baseline |
| Manual production approval? | **Yes** |
| Deployment strategy | **Blue/green** with health-check gating and **automatic rollback on alarm** (5xx rate, p95 latency, queue depth). **One open question for you — see "Questions back to AWS"** |
| Target rollback time | Application rollback in **seconds to minutes**. Data recovery via point-in-time restore within the 2-hour RTO |
| Migrations vs deployments | **Expand/contract:** additive changes first, destructive changes only after the old version is gone. Forward-only; recovery from a bad migration is the pre-migration snapshot |
| Secrets and config promotion | Secrets in **Secrets Manager**, non-secret config in **SSM Parameter Store**, injected per environment by ARN. Nothing in images, env files or client bundles. CI uses **GitHub OIDC** — no long-lived AWS keys |

## 18. Observability, SRE and operations

| Question | Answer |
|---|---|
| Who owns 24×7 support and receives alarms? | **TBD (owner: client)** |
| 24×7 or business hours? | **TBD (owner: client)** |
| Incident severities and response times | **TBD** — to be defined with the on-call model |
| Preferred tools | **Confirmed:** CloudWatch (logs, EMF metrics, dashboards, alarms) → SNS → **AWS Chatbot / Slack** and email; **Sentry** for errors; **X-Ray via ADOT** for traces; **CloudWatch Synthetics** for canaries. Paging tool and status-page product **TBD** |
| Log/metric/trace retention | CloudWatch Logs **30–90 days** by log group; metrics per CloudWatch defaults; audit logs **≥ 12 months** plus Object Lock archive |
| Distributed tracing request → job → AI? | **Confirmed: yes.** One correlation ID issued at the edge, carried as an SQS message attribute to the worker, attached to every AI-call log line, and returned to clients as `request_id` |
| SLOs | **Proposed from the targets:** CRUD p95 < 300 ms read / < 500 ms write · generation p50 < 45 s, p95 < 90 s, ≥ 99% terminal within 3 min · export < 10 s · job search < 2 s cached / < 5 s cold · JD extraction < 30 s · 99.5% availability. Authentication SLO **TBD** |
| Required alarms | Job failure rate · DLQ depth and oldest-message age · AI and job provider error rates · sustained AI fallback rate · prompt-cache hit rate · spend anomaly · provider quota approaching exhaustion · 5xx rate and p95 latency · Aurora and Valkey health · GuardDuty and Security Hub findings |
| Runbook ownership | Runbooks planned: deploy and rollback, DLQ replay, manual AI provider failover, database restore, DR rebuild, identity incident, key rotation, security incident, cost anomaly. **Owners TBD (owner: client)** |
| Synthetic checks from multiple geographies? | **Login, full generation round-trip and job search** canaries are confirmed. **Multi-geography** execution (US, Frankfurt, Sydney) is **proposed** — our latency targets apply in all three markets. Download check: to be added |

## 19. Cost and FinOps

| Question | Answer |
|---|---|
| Approved budget at launch and one year | See A8 — the estimate is there; **the approved ceiling is TBD (owner: client)** |
| Max infra cost per active user | **TBD.** Illustratively, ~$1,095/month across 10–20K MAU is ~$0.05–0.11 per MAU |
| Max AI cost per generated resume | **TBD.** Current estimates ~$0.11 (Sonnet-class) to ~$0.28 (Opus-class) with caching; the model choice is made on evaluation evidence |
| Alerts only, or automated throttling? | **Both.** Alerts for infrastructure; **automated per-user quotas and per-tier rate limits** for AI spend — enforced server-side, with published caps |
| Who reviews costs and how often | **Monthly** review confirmed; reviewer **TBD (owner: client)** |
| Savings Plans / RIs | **Yes** — a Compute Savings Plan evaluated after ~3 months of stable production baseline (−15–20% on Fargate) |
| Non-prod scale-to-zero / shutdown | **Yes:** Aurora scale-to-zero, Fargate Spot for workers, nightly scale-down of staging outside working hours, TTL on preview environments |
| Cost allocation | By **environment, service, component and owner** (tags); **AI cost per feature, per pipeline stage and per prompt version** from our own telemetry. By country: **TBD** if wanted |

## 20. Team ownership and operational readiness

| Question | Answer |
|---|---|
| Ownership of frontend, backend, AI, database, infra, security, payments, job providers | **TBD (owner: client)** |
| Final architecture decision-maker | **TBD (owner: client)** |
| Who approves production access and emergency changes | **TBD (owner: client)** |
| Two-person coverage for AI generation and billing | **TBD.** We agree it should be a launch requirement |
| Runbooks required before launch | Listed in §18; each must be **rehearsed**, not only written |
| Launch-readiness dashboards and alarms | Per-environment dashboards: traffic, errors, latency, queue health, generation funnel, **AI spend**, provider health — plus every alarm in §18 fired deliberately at least once |
| Beta exit criteria and sign-off | **Confirmed criteria:** no open critical/high defects; first-generation completion rate above an agreed threshold; **qualitative confirmation that users understand and trust the timeline-validation flags**; eval regression green on final prompts. Signatory **TBD (owner: client)** |
| Post-launch incident review ownership | **TBD (owner: client)** |

---

# C. Expected outputs — what already exists

Much of what Section C asks discovery to produce already exists in draft. We would like your review of
it rather than a restart.

| Expected output | Status |
|---|---|
| Confirmed requirements and constraints | **Exists** — our specification §7 (features) and §8 (non-functional) |
| Assumptions with owners and due dates | **This document**, plus our internal decision register |
| Open questions and launch blockers | **This document** — see the open items below |
| Architecture Decision Records | **Exists** — 15 decisions (D1–D15), each stating the choice, the alternatives and why they were rejected |
| Account / region / environment strategy | **Exists** |
| Target architecture and service-selection rationale | **Exists** — summarised in §0 |
| Security, IAM, networking, encryption, residency design | **Exists** — with the AI inference-geography gap now open (A6) |
| Availability, backup, RTO/RPO, DR design | **Exists** |
| CI/CD and IaC strategy | **Exists** |
| Observability, incident response, operational readiness | **Exists as a design**; runbooks and on-call model to be written |
| Capacity and cost model | **Exists** — re-verified against live AWS prices 2026-09-19. Launch / 6-month / 12-month scenarios need scale inputs from the client |
| Migration plan from Vercel / Supabase / Inngest | **Not applicable** — nothing depends on them |
| Production readiness checklist and phased rollout | **Exists** as a milestone-based implementation plan (M0–M6). Rollout is simultaneous across the three markets, and web and mobile launch together |

---

# Questions back to AWS

First, the two where we most want your recommendation:

- **Region strategy.** We have currently planned a single region (`us-east-1`) for all three markets,
  with backups in `us-west-2`. Is that what you would recommend for users in the US, Germany and
  Australia — and at what level of demand would you add compute closer to a market?
- **Launch markets.** We have planned for the US, Germany and Australia. If you had more countries in
  mind, please tell us which, so we can plan for their payment, tax and privacy requirements.

The rest are open items from our verification sweep that **you can likely close faster than we can**.

1. **ECS native blue/green in CDK.** AWS documentation confirms native ECS blue/green with lifecycle
   hooks exists and is recommended over CodeDeploy. We could not confirm support in `aws-cdk-lib`. If it
   is not supported, we fall back to CodeDeploy blue/green. **Which do you recommend today?**
2. **CloudFront origin timeout for SSE.** The origin read timeout defaults to 30 s; our design assumes
   60 s. Options are a quota increase, or a 60 s response-completion timeout with 15 s heartbeats keeping
   the stream alive. **Which is your recommended pattern for long-lived SSE through a VPC origin?**
3. **AI inference geography and retention.** Given A6: what is the cleanest configuration if US-pinned
   inference becomes a requirement, particularly for Haiku 4.5, and for Bedrock in `us-east-1` where the
   standard runtime offers only cross-region profiles?
4. **Throughput quotas** for Claude Platform on AWS and Bedrock, and the lead time to raise them.
5. **ElastiCache Serverless for Valkey minimums** (storage and ECPU) — not in the machine-readable price
   list.
6. **AWS Business Support+** — the pricing structure has changed; please confirm the current minimum.
7. **AWS Activate credits** — eligibility and the application route for NextKin.
8. **Your view** on keeping the Admin Portal in the same deployment (B1), and on SBOM generation (B16).

---

# Open items for the client

Collected from every **TBD** above, so they can be worked through in one sitting.

| # | Item | Blocks |
|---|---|---|
| 1 | **Purchase the domain** | SES, Cognito custom domain, Google OAuth review (1–4 weeks) |
| 2 | Approved monthly budget ceiling (infrastructure and AI) | Budget alarms, quota calibration |
| 3 | Target beta and launch dates | Scheduling |
| 4 | Business owner; final architecture decision-maker; payer account owner | Governance |
| 5 | Team roster, ownership per area, two-person coverage | Access model, on-call |
| 6 | Support model (24×7 vs business hours), paging tool, status page, incident severities | Operational readiness |
| 7 | Workforce identity provider behind Identity Center | Account setup |
| 8 | Accept 99.5% availability, or upgrade to 99.9% | Hardening scope |
| 9 | Whether AI inference must be pinned to the US | AI configuration, cost |
| 10 | German-language resume and JD generation — in or out of Release 1 | AI prompts, OCR, evaluation set |
| 11 | VAT/GST self-filed vs merchant of record | Payments (weeks of lead time) |
| 12 | Upload size limit, penetration test timing, secret rotation cadence, break-glass approvers | Security design |
| 13 | Launch / 6-month / 12-month scale figures | Capacity model |
| 14 | **Job providers — select based on budget** (stakeholder meeting required) | Job board, job-API cost line |

---

*Every figure marked "verified" was checked against a live AWS or vendor source on 2026-09-19. All other
prices are planning estimates from our specification's cost model and will be re-verified before
purchase.*
