# aws/infra: the NextKin demo on AWS

The AWS CDK app. Today it holds one stack, `NextkinDemo`: a single-account environment for
internal testing and client demos, running `APP_ENV=dev` in account `962942593570`, us-east-1.
The decisions behind it are in `toreview.md` §133. It is **not** staging: the local stand-ins it
runs are refused by config in staging and production (rule L3).

## What it creates

| Piece | Demo choice | Production (aws/architecture.md) |
|---|---|---|
| Front door | CloudFront on its `*.cloudfront.net` domain (HTTPS), load balancer accepts only CloudFront's secret header | Own domain, WAF, internal ALB |
| Compute | ECS Fargate x86_64: `web` (0.5 vCPU / 1 GB), `worker` (1 / 2 GB, Spot) | Graviton, 2–8 web tasks |
| Network | Public subnets, no NAT; security groups admit only the load balancer | Private subnets + NAT |
| Database | Aurora PostgreSQL 17 Serverless v2, 0–2 ACU (scales to zero, ~15 s wake) | 1–8 ACU, no scale-to-zero |
| Cache | Valkey container (`support` task), no persistence | ElastiCache Serverless |
| Email | Mailpit container (catches mail, sends nothing) | SES |
| Malware scan | ClamAV task (1 vCPU / 4 GB, Spot) | GuardDuty Malware Protection |
| AI | OpenRouter (`LLM_ROUTE=openrouter`) | Claude Platform on AWS → Bedrock |
| Sign-in | The local identity provider | Cognito |
| Storage, queues | 4 S3 buckets (S3-managed keys), 3 SQS FIFO queues + DLQs | KMS, Object Lock, replication |

Images are built from `docker/Dockerfile` on your machine and pushed to the CDK's ECR repository
on every deploy. Versions come from `docker/versions.env`.

**Cost:** roughly $100–115 a month if left running, most of it Fargate, the load balancer and public
IPv4 addresses. **The owner's choice is to pause it between demos** (`task pause`, below): about
$25/month stays (load balancer, secrets, database storage), so a few demo hours a week cost
~$30–40/month. Aurora idles at zero on its own.

## Before you start

- **Docker Desktop is running.** The deploy builds three images.
- **The CLI is signed in to NextKin:** `aws login --profile nextkin --region us-east-1`. The app
  refuses any other account, because `default` belongs to another client.

## First deploy

From the repository root:

```bash
# Once per account and region: the CDK's own bucket, ECR repository and roles.
pnpm --filter @nextkin/infra cdk bootstrap aws://962942593570/us-east-1 --profile nextkin

# The stack. The first run takes 20–30 minutes (Aurora, CloudFront, image builds).
pnpm --filter @nextkin/infra cdk deploy --profile nextkin

# The database, in this order: roles (once), schema, demo data.
pnpm --filter @nextkin/infra task db-roles
pnpm --filter @nextkin/infra task migrate
pnpm --filter @nextkin/infra task seed
```

Then put the real OpenRouter key in. It replaces a generated placeholder, and the services
re-read secrets only when tasks start:

```bash
aws secretsmanager put-secret-value --secret-id nextkin-demo/openrouter-api-key \
  --secret-string "<the key>" --profile nextkin --region us-east-1
aws ecs update-service --cluster <ClusterName> --service nextkin-demo-web --force-new-deployment --profile nextkin --region us-east-1
aws ecs update-service --cluster <ClusterName> --service nextkin-demo-worker --force-new-deployment --profile nextkin --region us-east-1
```

The deploy prints `AppUrl` and `ClusterName`. Check it with `curl <AppUrl>/api/v1/health/deep`.

## Signing in

The seed creates the same accounts as a laptop (`free@`, `pro@`, `admin@`, `curator@`,
`support@nextkin.test` and the two George Smith personas), but with **this environment's own
password and staff TOTP secret**, never the repository's published ones:

```bash
aws secretsmanager get-secret-value --secret-id nextkin-demo/seed-password --query SecretString --output text --profile nextkin --region us-east-1
aws secretsmanager get-secret-value --secret-id nextkin-demo/seed-totp-secret --query SecretString --output text --profile nextkin --region us-east-1
```

Emails (sign-up codes, password resets) land in Mailpit inside the VPC and are not delivered.
Use the seeded accounts until SES is connected.

**Web and mobile both use the API.** Web signs in on its designed `/sign-in` screen; a signed-out
visit to any app page is redirected there before it renders, and an expired session lands there
too. Eight web methods still answer from fixtures (notifications and three generation starts;
`DEMO.allowedMockFallbacks` in `src/settings.ts`). Mobile (Expo Go) needs `EXPO_PUBLIC_DATA_SOURCE=http` and
`EXPO_PUBLIC_API_BASE_URL` set to `AppUrl` in `apps/mobile/.env.local`. To deploy web on the mock
fixtures instead, add `-c webDataSource=mock`.

## The app's own address: app.nextkin.ai

`nextkin.ai` stays on Namecheap's DNS (with its email forwarding). Only `app.nextkin.ai` is
delegated to a Route 53 zone the stack owns (toreview §165). Two settings in `cdk.json` drive it:
`appDomain` (the name) and `appDomainLive` (phase 2). Keep both there; removing `appDomain`
deletes the zone and breaks the delegation.

1. **Phase 1** (`appDomainLive: false`): deploy. The stack outputs `DomainNameServers`.
2. **At Namecheap** → Domain List → nextkin.ai → Advanced DNS: delete any record whose host is
   `app`, then add four **NS** records, host `app`, one per nameserver from the output (no trailing
   dot needed). Check: `nslookup -type=NS app.nextkin.ai 8.8.8.8` lists the four.
3. **Phase 2**: set `appDomainLive` to `true` in `cdk.json` and deploy. ACM validates the
   certificate in the zone (a few minutes), CloudFront answers at `app.nextkin.ai`, and the app's
   origin moves there. The old `cloudfront.net` address stays trusted (`APP_EXTRA_ORIGINS`, S3 CORS).

To roll back: `appDomainLive: false` and deploy; then the NS records at Namecheap can go.

## Day to day

| Task | Command |
|---|---|
| Redeploy after code changes | `pnpm --filter @nextkin/infra cdk deploy --profile nextkin` |
| New migrations | Deploy, then `pnpm --filter @nextkin/infra task migrate` |
| New prompt or routing versions | Deploy, then `pnpm --filter @nextkin/infra task seed-reference` (leaves the accounts alone; `task seed` replaces them) |
| Logs (Git Bash: prefix `MSYS_NO_PATHCONV=1`) | `aws logs tail /nextkin-demo/web --follow --profile nextkin --region us-east-1` (also `worker`, `clamav`, `valkey`, `migrate`, `seed`) |
| A shell in a task | `aws ecs execute-command --cluster <ClusterName> --task <id> --container web --interactive --command sh --profile nextkin --region us-east-1` |
| **Pause between demos** | `pnpm --filter @nextkin/infra task pause` (every service to 0) |
| Resume before a demo | `pnpm --filter @nextkin/infra task resume` (2–4 min; ClamAV needs a few more for uploads) |
| Tear down | `pnpm --filter @nextkin/infra cdk destroy --profile nextkin`. The buckets are kept and the database leaves a final snapshot |

## Sign-up through Clerk (toreview §169)

Off until `clerkPublishableKey` is set. To turn it on:

1. Create the secret with the real key **before** deploying (never a placeholder: the server
   refuses one and the rollout stalls):
   `aws secretsmanager create-secret --name nextkin-demo/clerk-secret-key --secret-string sk_test_… --profile nextkin --region us-east-1`
2. Add `"clerkPublishableKey": "pk_test_…"` to `context` in `cdk.json` (it is public).
3. `pnpm --filter @nextkin/infra cdk deploy --profile nextkin`. The web image is rebuilt with the
   key, and web and worker switch to `IDENTITY_ADAPTER=clerk`.
4. In the Clerk Dashboard, allow the demo's origins if asked (https://app.nextkin.ai).

To change the key later: `put-secret-value` on the same secret, then `--force-new-deployment` on
web and worker. To turn Clerk off: remove `clerkPublishableKey` and deploy.

