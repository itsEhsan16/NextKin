# Working guide

Day-to-day work on the platform: getting access, deploying, finding out what happened, controlling
cost, and what to do when something breaks.

[`setup/`](setup/) is how the platform gets built. This is how you live with it afterwards.

> **Nothing is provisioned yet**, so every command here describes the intended workflow rather than
> one you can run today.

---

## Getting access

**There are no IAM users and no access keys.** A Service Control Policy prevents creating them.
Everyone signs in through IAM Identity Center with MFA.

```bash
aws sso login --profile nextkin-nonprod
aws sts get-caller-identity          # should show an assumed role, never an IAM user
```

| Profile | Account | What you get |
|---|---|---|
| `nextkin-nonprod` | nonprod | Administrator — dev, staging, previews |
| `nextkin-prod` | prod | Power user. **Deliberately not administrator** |
| `nextkin-billing` | management | Cost and budgets |

If you need something in production that power-user access does not allow, that is usually the system
telling you the change belongs in code and a deployment, not in a console.

---

## Deploying

Deployment is automatic. Merging to `main` deploys to `dev`. Tagging a release moves it through
staging to production behind a manual approval.

| Trigger | What happens |
|---|---|
| Pull request | lint · typecheck · tests against real containers · `cdk synth` · `cdk-nag` · dependency and secret scanning · a `cdk diff` comment on the PR |
| Merge to `main` | build arm64 image → ECR → **Inspector scan** → dev → migrate → deploy → smoke test |
| Tag | staging → end-to-end tests → **AI quality regression** → manual approval → **pre-migration snapshot** → prod |

Deployments are blue/green. New tasks take test traffic, pass health checks, then take real traffic —
and roll back automatically if 5xx rate, p95 latency or queue depth trips an alarm.

**Because old and new run side by side during a release, every schema change follows expand/contract.**
See [`migrations/README.md`](migrations/README.md).

### Rolling back

Rolling back the application is a deployment rollback and takes seconds. Rolling back a *migration* is
not a thing — migrations are forward-only. If a migration caused the problem, the path is the
pre-migration snapshot, and that restore is rehearsed quarterly so it is known to work rather than
hoped to.

### Deploying infrastructure by hand

Only in `nonprod`, only when iterating, never in production:

```bash
cdk diff   --context env=dev        # always read this first
cdk deploy --context env=dev
```

Production changes go through the pipeline. Nobody clicks in the console — not because of a rule, but
because a console change is invisible to the next person and disappears on the next deployment.

---

## Finding out what happened

### One ID traces everything

A correlation ID is issued at the edge and travels: **request → API → SQS message attribute → worker
→ AI call.** One ID answers "what happened to this user's generation at 2am?".

It is returned to the client as `request_id` in every error response, so a support ticket that quotes
the error gives you the thread immediately.

```
fields @timestamp, @message
| filter correlation_id = "abc123"
| sort @timestamp asc
```

### Logs

CloudWatch Logs, structured JSON, **PII-scrubbed by default**. Resume content and contact details
never appear in a log line — there is a test that asserts it.

If you find yourself wanting to log a resume to debug something, that is the signal to add a
correlation ID to more places instead.

### Metrics and dashboards

One dashboard per environment: traffic, errors, latency, queue depth and age, the generation funnel,
**AI spend**, and provider health.

### Traces

X-Ray, via ADOT. Useful when latency is the problem and you cannot tell which hop owns it.

### Every AI call is recorded

Provider, endpoint, model, prompt template ID and version, tokens in and out, cache read/write tokens,
latency, cost, and outcome — linked to the generation ID.

This is what makes a prompt rollback evidence-based rather than superstitious: you can compare two
prompt versions on quality *and* cost over real traffic.

---

## The alarms that page someone

| Alarm | Means | First move |
|---|---|---|
| **DLQ depth or oldest-message age** | Jobs are failing repeatedly | Read one failed message, find the stage, check the provider |
| **Generation failure rate** | Something in the pipeline is broken | Usually an AI provider or a schema-validation failure |
| **AI provider errors** | Primary endpoint degraded | Confirm the chain failed over to Bedrock; if not, why not |
| **Spend anomaly** | Cost spike | Check AI token telemetry per feature before assuming it is infrastructure |
| **Quota exhaustion** | A provider limit is close | Job providers degrade gracefully; the AI endpoint does not |
| **5xx rate or p95 latency** | Usually a bad deploy | It should already have rolled itself back — check whether it did |

Alarms route through SNS to Slack. Runbooks live in `aws/runbooks/`.

**Both DLQ alarms exist deliberately.** Depth alone misses a queue that is slowly poisoning — a
handful of messages failing repeatedly never builds enough depth to fire, but the oldest-message age
climbs steadily.

---

## Canaries

Synthetic checks run continuously against a fixture account: sign in, a full generation round-trip,
and a job search. They exist so breakage is found by a robot at 3am rather than by a customer at 9am.

Their spend is tagged separately so it does not contaminate the AI cost dashboard or trigger the
anomaly detector.

---

## Cost

| Grouping | Typical / month `[verify]` |
|---|---|
| Compute — API and worker containers, load balancer, egress | ~$190 |
| Database and cache | ~$212 |
| Edge — CDN, firewall, DNS, certificates | ~$27 |
| Storage, keys, secrets, email, queues, OCR | ~$39 |
| Identity | $0 below 10,000 monthly active users |
| Security and monitoring | ~$175 |
| Backups, data transfer, support | ~$120 |
| **Production total** | **≈ $760** |
| Non-production — dev, staging, previews, org security baseline | ≈ $330 |
| **All in** | **≈ $1,130** |

**AI tokens are the larger number at scale.** A full generation costs roughly $0.17–0.31 depending on
which model tier writes the resume. At 30,000 generations a month that is $5,100–8,100 — several times
the entire infrastructure bill.

Which is why the single largest cost decision in this system is **which model writes the resume**, and
why it is made on evaluation evidence against a golden set rather than by defaulting to the most
capable option.

Every figure above is from the specification's cost model and is re-verified during
[step 0](setup/06-verification.md).

### Keeping it honest

- Cost allocation tags (`env`, `service`, `component`) are mandatory, enforced organisation-wide
- Budget alerts at 50/80/100% per account
- Cost Anomaly Detection at a $50/day threshold
- Non-production databases scale to zero
- Preview environments have a time-to-live and destroy themselves
- Per-feature AI token telemetry from the moment the pipeline exists

---

## Working with the data

### Reaching the database

Aurora sits in isolated subnets with no internet route. Access is through a bastion or SSM session
manager, read-only, and **production access is exceptional, reasoned and audited** — the same standard
that applies to admins viewing user content in the portal.

The reflex should be to answer the question from logs and metrics first. Reading production resumes to
debug something is a last resort, not a first one.

### The mistake everyone makes once

```
Symptom:  a query returns no rows for a user who definitely has data
Cause:    app.user_id was not set on that transaction
```

Row-level security does not error when the variable is missing — it filters everything out. So the
failure looks like missing data rather than a permissions problem, and people go looking in the wrong
place.

The guard against it is structural: no query path should be able to reach the database without the
variable set, and there is a test that tries.

---

## Secrets

Everything in **Secrets Manager**, KMS-encrypted, one secret per provider. Nothing in an image, an
environment file, a client bundle or a chat message.

The primary AI path has **no secret at all** — it authenticates with the ECS task role. That is a large
part of why it was chosen.

Provider keys entered through the admin portal are **write-only**: they go straight to Secrets Manager
and there is no code path that reads them back out. If someone needs to see a key, they rotate it
instead.

---

## Environments

| Environment | Reachable at | Data | Notes |
|---|---|---|---|
| local | `localhost` | Seeded fixtures | No AWS needed |
| dev | `dev.<domain>` | Seeded | Deploys on every merge |
| preview | per-PR URL | Seeded | Opt-in, self-destructs after 3 days |
| staging | `staging.<domain>` | Seeded, production shape | **Never production PII** |
| prod | `<domain>` | Real | |

**Staging never holds production data.** Copying real resumes into a lower environment is the fastest
way to turn a staging incident into a privacy incident.

---

## When AWS itself has a problem

Graceful degradation is a design requirement, so most dependency failures are not outages:

| What fails | What users see |
|---|---|
| A job provider | Fewer search results. Nothing else |
| The AI provider | Generation pauses with a status banner; queued jobs retry. Everything else works |
| Valkey | Users are signed out and caches are cold. **Nothing durable is lost** — the database is the only system of record |
| One availability zone | Nothing. Every tier runs in two |
| Stripe | Paying users keep their features — entitlements are read from our own database, never from Stripe live |

The one that is not graceful is a **full region loss**: up to 24 hours of data and a four-hour rebuild,
and because Cognito pools cannot be replicated, users re-authenticate through Google or Apple or reset
their passwords. That is written into the incident runbook and the status-page communications plan
rather than discovered during the incident.
