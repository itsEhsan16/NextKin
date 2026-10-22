# 3 · Accounts and access

**Owner: engineer, with the client for billing** · **Time: about two days** · **Status: not started**

This is the step that is cheap now and genuinely painful later. Separating production from
non-production after real customer data exists means moving live data between accounts. Two days now
avoids that permanently.

## The account layout

```
AWS Organization
├── management      billing and organisation policy only — NO workloads, ever
├── prod            live. Real customer data
├── nonprod         dev, staging, and per-PR preview environments
└── security        receives the audit trail from all accounts (recommended)
```

**Why separate accounts rather than tags:** a tag is not a security boundary. One mis-scoped
permission spans every environment. With separate accounts, a mistake in a development script
physically cannot read or delete production customer data.

The full AWS Control Tower landing zone is the right answer later — it is the documented upgrade path
when SOC 2 or enterprise contracts arrive — but it is one to two weeks of opinionated setup that is
not needed yet.

## Steps

### 1. Create the Organization

From the management account, enable **all features** (not just consolidated billing — the guardrails
below need them).

Create the member accounts. Each needs a unique email address; a plus-address on a distribution list
works well and keeps them all reaching the right people:

```
aws-management@<domain>
aws-prod@<domain>
aws-nonprod@<domain>
aws-security@<domain>
```

Set the root user of every account to a long random password held in a password manager, enable MFA on
each, and then **never use a root user again**.

### 2. Apply the guardrails

Service Control Policies, applied from day one. These are organisation-wide rules that no account —
including an administrator in it — can override:

| Policy | What it prevents |
|---|---|
| Deny leaving the organisation | An account being detached and escaping the guardrails |
| Deny disabling CloudTrail, GuardDuty or Security Hub | Someone turning off the audit trail, accidentally or otherwise |
| Deny creating IAM user access keys | Long-lived credentials existing anywhere. This one matters most |
| Restrict to approved regions (`us-east-1`, `us-west-2`) | Resources appearing in regions nobody is monitoring or paying attention to |
| Require cost-allocation tags (`env`, `service`, `component`) | Untraceable spend |

### 3. Set up human access

**IAM Identity Center**, with MFA required, and permission sets scoped by role:

| Permission set | Accounts | Who |
|---|---|---|
| `AdministratorAccess` | `nonprod` | Engineers |
| `PowerUserAccess` | `prod` | Engineers — deliberately not admin |
| `ReadOnlyAccess` | `prod` | Everyone else |
| `Billing` | `management` | Whoever owns the budget |

**No individual IAM users. No long-lived access keys. Anywhere.** The SCP above enforces it, but the
habit matters more than the rule — every credential that does not exist is one that cannot leak.

### 4. Set up CI access

GitHub Actions authenticates through **OIDC federation**, not a stored key:

1. Create the GitHub OIDC identity provider in each deployment account
2. Create a deployment role with a trust policy scoped to **this repository and specific branches** —
   not to the whole GitHub organisation, which is a common and dangerous shortcut
3. Grant it what it needs to deploy and nothing more

**The deployment role must not be able to read production data.** It deploys infrastructure; it has no
business reading a resume. Verify this explicitly rather than assuming it.

The repository currently holds exactly one secret, `EXPO_TOKEN`, used by the mobile build workflows.
The AWS role ARNs join it as repository variables — they are not secrets, since the trust policy is
what grants access.

### 5. Turn on the security baseline

In every account:

- **CloudTrail** → delivered to the security account, log file validation on
- **GuardDuty** → enabled, including Malware Protection for S3
- **Security Hub** → Foundational Security Best Practices standard
- **AWS Config** → recording enabled
- **IAM Access Analyzer** → enabled

Record the initial Security Hub score. It is a required exit criterion for phase M0 and the baseline
you improve against.

### 6. Set up cost controls before anything expensive exists

- **Budgets** per account with alerts at 50%, 80% and 100% of forecast
- **Cost Anomaly Detection** with a $50/day threshold
- **Cost allocation tags** activated in the billing console — the SCP requires them, but they also
  have to be switched on for reporting before they appear in reports

Do this now. Cost controls added after a surprise bill are a reaction; added before, they are a
control.

## Done when

```bash
aws organizations list-accounts                      # four accounts
aws sts get-caller-identity                          # an Identity Center role, not an IAM user
aws iam list-users                                   # empty in every account
```

- [ ] Four accounts exist under one Organization with all features enabled
- [ ] All five SCPs attached and tested — try creating an access key and confirm it is denied
- [ ] Identity Center with MFA; every engineer can reach `nonprod` and nobody uses a root user
- [ ] GitHub OIDC works from a test workflow, with **no stored AWS credential**
- [ ] The deployment role is confirmed unable to read production data
- [ ] CloudTrail, GuardDuty, Security Hub, Config and Access Analyzer on in every account
- [ ] Security Hub baseline score recorded with the date
- [ ] Budgets and anomaly detection live

## Next

[Step 4 — local development](04-local-development.md), which needs none of this and can have been
running in parallel.
