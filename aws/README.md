# AWS

The operational home for everything AWS: the architecture reference, the setup runbooks, the working
guide, and the database migrations.

| | |
|---|---|
| **Status** | **Nothing is provisioned yet.** No AWS account has been opened, no domain registered, no resource created. Every document here describes what will be built. |
| **Region** | `us-east-1` (N. Virginia) primary · `us-west-2` (Oregon) for backup copies only |
| **Binding source** | `doc/NextKin-Apply-V2-Project-Specification.md` §8–§12 — when this folder and the spec disagree, the spec wins |
| **Build order** | `doc/NextKin-Backend-Implementation-Plan.md` — phase M0 is what this folder covers |

## Why this folder exists separately from `doc/`

`doc/` is in `.gitignore`. Those files are internal planning documents that stay on one machine — the
specification, the architecture argument, the stakeholder guide, the implementation plan.

**This folder is committed to the repository.** It is the working material a developer opens while
actually building or operating the platform: what to click, what to run, what a resource is for, and
what to do when something breaks. Keep the planning in `doc/`, keep the doing here.

## What is in here

| Path | What it is | Read it when |
|---|---|---|
| [`architecture.md`](architecture.md) | Every AWS resource, what it does, how they connect, and how a request travels | You need to know what exists and why |
| [`guide.md`](guide.md) | Working with the platform day to day — deploying, logs, tracing, access, cost, incidents | You are building on it or operating it |
| [`setup/`](setup/) | The ordered path from zero to a working `dev` environment | You are provisioning it for the first time |
| [`migrations/`](migrations/) | Database schema migrations and the rules for writing them | You are changing the database |
| [`runbooks/`](runbooks/) | What to do when something breaks: deploy and rollback, DLQ replay, AI failover, restore, key rotation, security incident, cost anomaly; owner roles | Something is wrong, or before it is |
| [`drills/`](drills/) | Dated records of resilience, restore and load drills with their measurements | You need the last measured RTO or p95 |
| [`security/`](security/) | The threat model and the security checklist with its evidence | You change a trust boundary, or before a release |
| `infra/` | The AWS CDK application — *not created yet* (see note below) | — |

## Start here

Nothing is provisioned. The path is ordered and each step unblocks the next:

1. **[`setup/02-domain-and-dns.md`](setup/02-domain-and-dns.md)** — buy the domain. **Do this first,
   even before the AWS accounts.** It is the cheapest item on the list and it is holding up a 1–4 week
   Google sign-in approval clock that four other things depend on.
2. **[`setup/03-external-filings.md`](setup/03-external-filings.md)** — start the approval
   applications. They run in the background while everything else is built.
3. **[`setup/01-accounts-and-access.md`](setup/01-accounts-and-access.md)** — open the AWS
   Organization and accounts, set the guardrails, wire up staff and CI access.
4. **[`setup/04-local-development.md`](setup/04-local-development.md)** — the local stack. This one
   needs no AWS at all, so it can start in parallel with steps 1–3.
5. **[`setup/05-first-deployment.md`](setup/05-first-deployment.md)** — get `dev` running and prove it.

## A note on `infra/`

The implementation plan proposes the CDK application at `infra/` in the repository root. Now that this
folder exists, **`aws/infra/` is the more consistent home** — it keeps the platform code beside the
architecture that describes it and the runbooks that operate it.

That is a one-line change to the plan and to `pnpm-workspace.yaml`, and it has not been applied yet.
Decide it before the CDK application is created, because moving a CDK app after it has deployed
something means either renaming every stack or carrying the old path forever.

## A note on `migrations/`

Database migrations live here because this folder is the agreed home for them. Worth knowing when you
read them: **they are not AWS-specific.** They run against plain PostgreSQL — the local
`docker compose` database during development, and Aurora in the cloud. Nothing in a migration file
should depend on AWS, and if one ever does, that is a bug rather than a convention.

See [`migrations/README.md`](migrations/README.md) for how they are written and applied.

## The three rules that shape everything here

1. **No server of ours has a public address.** Traffic enters through CloudFront, reaches an internal
   load balancer over a private connection, and nothing behind it is reachable from the internet.
2. **No AI call ever happens inside a web request.** Generation is queued and run by a separate worker
   in checkpointed stages. A 90-second wait inside an HTTP request is fragile on any platform.
3. **The database refuses to return one user's rows to another**, through PostgreSQL row-level
   security, regardless of what the application layer does. It is a second lock on the door, not a
   convenience.
