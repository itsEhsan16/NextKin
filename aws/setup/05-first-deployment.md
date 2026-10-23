# 5 · First deployment

**Owner: engineer** · **Time: days** · **Needs: steps 0–4 complete**

Getting `dev` running, and proving it works rather than assuming it does.

## Order of deployment

The stacks have dependencies, so they deploy in this order. Each one is a separate CDK stack so a
failure is isolated and re-runnable.

| # | Stack | Creates | Depends on |
|---|---|---|---|
| 1 | `security-baseline` | SCPs, CloudTrail, GuardDuty, Security Hub, Config | The Organization |
| 2 | `network` | VPC, subnets, NAT, S3 gateway endpoint, security groups | — |
| 3 | `data` | Aurora, Valkey, the five S3 buckets, KMS keys | `network` |
| 4 | `identity` | Both Cognito pools, the Google and Apple IdPs, the custom domain | `network`, the domain |
| 5 | `async` | The three SQS FIFO queues, their DLQs, EventBridge Scheduler | `data` |
| 6 | `compute` | ECS cluster, `web` / `worker` / `migrate` task definitions, internal ALB | All above |
| 7 | `edge` | CloudFront, WAF, Route 53 records, ACM certificates | `compute` |
| 8 | `observability` | Log groups, dashboards, alarms, canaries | All above |

> **Not created yet.** The CDK application is task M0-05. See the note in
> [`../README.md`](../README.md) about whether it lives at `infra/` or `aws/infra/` — decide before it
> is written, because moving a CDK app after it has deployed means renaming every stack.

## The settings that cannot be changed afterwards

Before deploying the `identity` stack, confirm all eight. **Cognito fixes these at pool creation.**
Changing one later means creating a new pool and migrating every user — which, since password hashes
cannot be exported, means every user resets their password.

| Setting | Value | Why |
|---|---|---|
| Sign-in alias | `email` | Users sign in with their email address |
| Username case sensitivity | **Case-insensitive** | `Alice@` and `alice@` must be one account |
| Required attributes | `email`, `name` | Apple returns a name only on first authorization — if it is not captured then, it is gone |
| Prevent user existence errors | **Enabled** | Otherwise the error messages tell an attacker which addresses are registered |
| Refresh-token rotation | **Enabled** | A stolen refresh token is usable once, not forever |
| Access / ID token lifetime | **60 minutes** | — |
| Refresh-token lifetime | **30 days** | This is the absolute session lifetime |
| MFA | **Required on the `admins` pool only** | MFA policy in Cognito is pool-wide, which is precisely why there are two pools |

Get a second person to check this table against the deployed pool before anyone signs up.

## Deploying

```bash
cdk bootstrap aws://<nonprod-account>/us-east-1     # once per account and region
cdk deploy --all --context env=dev
```

Then, as a separate one-off ECS task run by the pipeline:

```bash
# the `migrate` task, running as the database OWNER role
pnpm migrate
```

Migrations run as the owner. The application connects as a **different, non-owner role with no
`BYPASSRLS`** — that separation is what makes row-level security a real boundary rather than a
convention. See [`../migrations/README.md`](../migrations/README.md).

## Proving it works

A deployment that returns "CREATE_COMPLETE" has proved nothing. These are the checks.

### Reachability and isolation

```bash
curl https://dev.<domain>/api/v1/health          # 200
curl https://dev.<domain>/api/v1/health/deep     # 200, database and cache reachable
```

- [ ] The ALB DNS name is **not** resolvable or reachable from the public internet
- [ ] No ECS task has a public IP
- [ ] The database and cache cannot be reached from outside the VPC
- [ ] TLS is valid and HSTS is present

### The end-to-end proof — the M0 exit gate

A **hello-world generation round-trip**: enqueue → worker picks it up → a real AI call → persisted to
the database. If that works in `dev`, the platform is real.

- [ ] A generation reaches `ready` in `dev` against real AWS
- [ ] Its progress streamed over SSE through CloudFront, without buffering
- [ ] The correlation ID traces the request from the edge through the API, into the queue, into the
      worker, into the AI call — one ID, all four hops

### Row-level security

The check that matters most, because it is the second lock on the door:

- [ ] Signed in as user A, every attempt to read, update or delete user B's rows returns nothing —
      across **every** user-owned table
- [ ] The application role **cannot** run `ALTER TABLE … DISABLE ROW LEVEL SECURITY`

### The upload gate

- [ ] An oversized file is rejected **by S3**, not by application code
- [ ] A wrong content-type is rejected by the presigned POST policy
- [ ] An object without the clean-scan tag returns `AccessDenied` even to the worker role
- [ ] The parse job is only enqueued after the scan tag appears

### Deployment mechanics

- [ ] A deploy shifts traffic only after health checks pass
- [ ] `cdk-nag` is clean, and every suppression carries a written justification in the code
- [ ] Inspector scanned the image and a critical finding blocks deployment
- [ ] The pipeline holds **no stored AWS credential** — it authenticates through OIDC

### Cost

- [ ] Every resource carries `env`, `service` and `component` tags
- [ ] Budget alerts are live
- [ ] The first day's actual spend is recorded and compared against the estimate

## When something fails

| Symptom | Usual cause |
|---|---|
| CloudFront returns 502 | The ALB is internal and the VPC origin is misconfigured, or the target group is unhealthy |
| SSE stream cuts off around 30–60 s | Caching or compression is still enabled on that behaviour, or the origin response timeout is at its default |
| Cognito custom domain will not create | No A record on the parent domain, or the certificate is not in `us-east-1` |
| Migrations fail with a permission error | Running as the application role instead of the owner |
| Queries return no rows for a valid user | `app.user_id` was not set on that transaction — the most common RLS mistake, and it looks like missing data rather than an error |
| Worker never picks up a message | Wrong queue URL, or the task role lacks `sqs:ReceiveMessage` |

## Done when

- [ ] All eight stacks deploy cleanly to `dev` from `main`
- [ ] Every check above passes
- [ ] The Security Hub score is recorded
- [ ] Deploying to `staging` and `prod` works from the same code with only a context change
