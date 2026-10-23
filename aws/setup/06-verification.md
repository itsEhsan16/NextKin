# 0 · Verify the facts first

**Owner: engineer** · **Time: half a day** · **Do this before building anything**

The specification's Appendix C lists eighteen facts that expire — service features, prices, quotas,
provider terms — each with a named fallback. It requires every one re-verified at build time.

This is numbered 0 because it genuinely comes first. **Four of the eighteen change what gets built,
not just what it costs.** Discovering one of those after a week of CDK work means unpicking the week.

## The four that change a design

| # | Verify | If it has changed |
|---|---|---|
| **1** | **Claude Platform on AWS** — availability in a US region, Message Batches, prompt caching, the zero-retention workspace setting, Marketplace subscription prerequisites | Make **Bedrock the primary** and the direct Anthropic API secondary. This reverses the whole AI routing chain and the task-role permissions built around it |
| **4** | **CloudFront VPC origins** available at no extra charge, origin response timeout configurable to 60 s | The edge stack changes from a private VPC origin to a **public ALB locked to CloudFront's prefix list plus an origin secret header**. Materially different networking, and a weaker security posture that has to be explained |
| **5** | **ECS native blue/green deployment** supported in CDK | Use **AWS CodeDeploy** instead. Changes the compute stack's deployment construct and the pipeline around it |
| **6** | **GuardDuty Malware Protection for S3** — pricing and the exact tag key and value | The bucket policy denies reads on a literal tag condition. If the semantics changed, the deny is silently wrong — or fall back to running an open-source scanner step in the worker before parsing |

Read that fourth row carefully. A wrong tag condition does not fail loudly; it quietly permits reads
of unscanned files. It is the kind of thing that is only found by testing it deliberately.

## The rest

Verify and record, but none of these changes a stack's shape:

| # | Verify | Fallback |
|---|---|---|
| 2 | Current Claude model IDs and list prices | Recompute the cost model and the per-tier quotas |
| 3 | Cognito tier features and pricing | Re-cost; consider the higher tier if threat protection is wanted |
| 7 | Aurora Serverless v2 scale-to-zero on the chosen PostgreSQL major | Non-production costs rise; production is unaffected since scale-to-zero is disabled there anyway |
| 8 | Stripe fees and tax coverage for US, Germany and Australia | Switch to a merchant-of-record provider |
| 9–18 | Job-provider quotas and pricing, Textract pricing, ElastiCache Serverless minimums, SES quotas, Fargate arm64 pricing, and the remaining rows in Appendix C | Recorded per row |

## Pin the PostgreSQL major version

Not from Appendix C, but it belongs in the same pass because three things have to agree on it:

- the local `docker-compose` container
- the Aurora cluster
- every migration file

Pin it **in one place** that all three read. Discovering a mismatch during the first cloud deployment
is a bad day.

## How to record the results

One consolidated file — `doc/decisions/appendix-c/README.md`:

| # | Fact | Status | Date | Evidence | Fallback applied | Tasks changed |
|---|---|---|---|---|---|---|
| 1 | Claude Platform on AWS in us-east-1 | verified | | link | — | — |
| 4 | CloudFront VPC origins free | **changed** | | link | public ALB + origin secret | M0-19, M0-11 |
| … | | | | | | |

Every row gets one of three verdicts: **verified**, **changed — fallback applied**, or **blocked —
with an owner**. Every applied fallback names the task it changes, and **that task's description is
updated before the task starts**, not after someone has built the wrong thing.

The refreshed cost table goes in a separate file, `doc/decisions/appendix-c/cost-refresh.md`,
mirroring the specification's §9.15 tables with a source and a date per line.

**The specification itself is never edited.** Overwriting its numbers destroys the record of what the
project was planned against — and a planned-versus-verified comparison is the whole point of doing
this.

## Done when

- [ ] All eighteen rows carry a dated verdict
- [ ] Every applied fallback names the task it changes, and that task has been updated
- [ ] The PostgreSQL major version is pinned in one place
- [ ] The cost refresh exists with a source and date per line
- [ ] The specification is unmodified

## Next

[Step 1 — domain and DNS](02-domain-and-dns.md), if it has not already been done. It should have been.
