# 2 · External filings

**Owner: client** — every one of these needs a login, a payment method or a legal identity that cannot
be delegated · **Status: none filed**

These are applications and purchases, not engineering. File them early and they process quietly in the
background while the code is written. File them late and each one is added to the end of the project.

## The tracker

Copy this into the project board. One row per filing, and keep the dates honest — a filed application
nobody chases is the same as an unfiled one.

| # | Item | Lead time | Blocks | Needs first | Filed | Landed |
|---|---|---|---|---|---|---|
| 1 | **Google OAuth consent verification** | **1–4 weeks** | Google sign-in without a browser warning | Domain + **published privacy policy URL** | | |
| 2 | AWS Organization + accounts | Days | Everything on AWS | Payment method | | |
| 3 | AWS startup credits | Days | Nothing — but may cover most of year one | AWS account | | |
| 4 | SES production access + quota increase | 2–3 days | Verification email to real addresses | AWS account + domain | | |
| 5 | Apple Developer account | Days, sometimes longer | Sign in with Apple | Legal entity, payment | | |
| 6 | Apple Services ID + Sign in with Apple key (`.p8`) | Hours after 5 | Sign in with Apple | Item 5 | | |
| 7 | Apple private-relay sending domain | Hours | Apple users receiving our email | Items 4, 5 | | |
| 8 | Claude Platform on AWS — Marketplace subscription | Days | The AI pipeline | AWS account | | |
| 9 | Org-level outbound web identity federation | Hours | Item 8 | AWS Organization | | |
| 10 | Bedrock model access + throughput quota | Hours–days | AI failover | AWS account | | |
| 11 | Adzuna API keys — US, DE, AU | Days | Job board | — | | |
| 12 | JSearch subscription | Hours | Job descriptions and salary data | Payment | | |
| 13 | Stripe account activation | Days | Taking money | Legal entity, bank account | | |
| 14 | Stripe Tax configuration | Hours | Correct VAT/GST | Item 13 | | |
| 15 | **German VAT registration** (or EU OSS) | **Weeks** | Selling in Germany | Accountant | | |
| 16 | **Australian GST registration** | **Weeks** | Selling in Australia | Accountant | | |
| 17 | AWS Business Support | Immediate | Nothing, but activate before the first real beta user | AWS account | | |

## File these in the first week

**Items 1, 2, 4, 5, 8.** Everything else can follow.

Item 1 is the one that hurts most if delayed, and it has an awkward dependency: Google wants a
**published privacy policy URL** on the consent screen. So the legal work has to start before the
Google filing, not after. That is why the implementation plan puts counsel engagement at phase M3
rather than M6.

## Notes per item

### 1 · Google OAuth consent verification

Google reviews the consent screen before showing your branding. Until it passes, users see an
"unverified app" warning. You will need: the domain, a published privacy policy, a published terms
page, an app logo, and the list of scopes (for us: `email`, `profile`, `openid` — nothing sensitive,
which keeps the review at the simpler tier).

**Do not request sensitive or restricted scopes.** They trigger a much longer security assessment.

### 2 · AWS Organization and accounts

Create: a **management** account (billing only, no workloads), **prod**, **nonprod**, and — recommended
— **security** to receive the audit trail. Details in
[accounts and access](01-accounts-and-access.md).

### 3 · AWS startup credits

Worth applying for. If granted it offsets most of the first year's infrastructure cost. It needs an
AWS account first, so it goes with item 2. Recorded as decision **D-04**.

### 4 · SES production access

New SES accounts are sandboxed: you can only send to addresses you have manually verified. That means
**sign-up cannot be tested end to end with a real email address until this lands.** Request it as soon
as the account and domain exist. Set up the `mail.<domain>` sending identity with DKIM, SPF and DMARC.

### 5–7 · Apple

Sign in with Apple requires a paid Apple Developer account, a Services ID, and a `.p8` key. Upload the
`.p8` to Cognito — Cognito then generates Apple's client-secret JWT itself, which saves a six-monthly
rotation chore.

Also register the sending domain for **Sign in with Apple for Email Communication**, or mail to
Apple's private-relay addresses will be rejected. This is easy to forget and only shows up as silent
delivery failures to a subset of users.

### 8–9 · Claude Platform on AWS

Two parts: an **AWS Marketplace subscription**, and an **organisation-level setting** — outbound web
identity federation — that must be enabled before the subscription works. Create one workspace per
environment (`nonprod`, `prod`) in a US region and **verify the data-retention setting at creation**;
record it in the subprocessor register, because it goes in the privacy policy.

### 11–12 · Job providers

Adzuna is the official, compliant backbone with country endpoints for all three launch markets. Its
free tier defaults are 25 requests/minute, 250/day, 1,000/week, 2,500/month, negotiable upward.

JSearch supplies full descriptions and salary data. Note for the record: **its supply chain aggregates
Google for Jobs, which Google's terms prohibit.** It is treated as a swappable dependency behind the
adapter interface and is never described to users as an official source.

Re-read both providers' terms at key issuance — attribution sizing, salary branding, caching limits
and the tracked-redirect obligation all change over time and are not covered by the standing
verification checklist.

### 13–16 · Payments and tax

Stripe Billing with Stripe Tax. Registration thresholds and filing obligations are an accounting
question, not a technical one — involve the accountant early.

There is an alternative worth knowing about: a **merchant-of-record** provider handles tax
registration and remittance for you, at a materially higher cut. If VAT and GST administration proves
burdensome, that is the documented fallback. Recorded as decision **D-03**, and it needs deciding
before phase M5 because the lead times are long.

## Done when

- [ ] Every row has an owner and a filed date
- [ ] Items 1, 2, 4, 5 and 8 are filed
- [ ] The weekly chase is in the calendar — no row sits unchanged for two reviews without escalation
- [ ] Every credential that arrives goes into **Secrets Manager**, never into a file, a message or an
      environment variable

## Next

[Step 3 — accounts and access](01-accounts-and-access.md).
