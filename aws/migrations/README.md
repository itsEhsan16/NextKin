# Database migrations

Every change to the database schema lives here, as a numbered file, applied in order, forward only.

**Status (2026-10-11):**
- The baseline, `0001`–`0006`, holds 48 tables in the `app` schema, the RLS helpers, and the dormant
  org hook. It was built in P2 of `doc/ImBackendImplementationPlan.md` against PostgreSQL 17.
- `0007` (P6) adds `scheduler_runs`, `ai_calls`, the outbox's retry time and the system role's
  outbox insert.
- `0008` (P7) adds `uploads`, `resume_parses` (owner RLS) and `anonymous_uploads` (the teaser,
  reachable by the system role only, purged after 24 hours).
- `0009`–`0010` (P9) give `job_descriptions` an extraction status, stats and its upload, add the
  system-only `kb_review_queue`, let the system role file KB candidates, and index the JD cache hash
  (concurrently, in its own no-transaction file).
- `0011`–`0016` (P9) fix deleting a user once documents exist. A reference reached along two cascade
  paths now cascades (versions, reports and letters follow their generation) or clears only its own
  column (a JD, an upload). Each is added `NOT VALID` and validated in the next file. `0011`'s
  set-null was wrong for the immutable tables, and `0013` corrects it.
- `0017`–`0018` (P10) let a resume be deleted while runs and letters point at it. A generation keeps
  its record with the resume cleared, and a letter keeps its body with its source version cleared.
  They also add the `section` run kind and `export_events`, the record of every export that holds
  the reference to its file, so a purge deletes files by reference. The replaced constraints are
  validated in `0018`.

**Commands:**

| Command | What it does |
|---|---|
| `pnpm migrate` | Applies pending files as the owner role |
| `pnpm --filter @nextkin/server db:types` | Regenerates the Kysely types; CI fails if they drift from the schema |
| `pnpm seed` | Loads reference data, the role accounts and the two demo personas |

**Until the first shared environment exists**, the baseline may be re-cut with
`pnpm migrate:rebaseline` (rule L8). That drops the `app` schema and re-applies everything. It is
refused outside `local` and `test`. From the first `dev` deploy on, every file is immutable, and the
runner refuses an edited one.

**Adding a user-owned table:** call `SELECT app.apply_owner_rls('app.<table>');` in the same file. Add
`'user_id', true` as the extra arguments when the table carries `org_id`. The helper enables and
forces RLS, creates the owner, maintenance and staff policies, and grants the right privileges. The
RLS suite (`packages/server/test/integration/rls.int.test.ts`) discovers tables from the catalog. It
fails any table without RLS, and any user-owned table that `fixtures/userGraph.ts` gives no rows.

**Staff reads use a separate role.** Support and admin reads go through `nextkin_readonly`
(`withStaff`, with a recorded reason), not through an admin branch in the app role's policy. The app
role's predicate stays `user_id = app.current_user_id()`, which Postgres can always serve from an
index. The P2-09 EXPLAIN gate proves it on synthetic volume.

## These are not AWS-specific

They live in the `aws/` folder because that is the agreed home for them, but **nothing in a migration
file should depend on AWS.** They run against:

- the local `docker compose` PostgreSQL container, during development and in CI
- Aurora PostgreSQL Serverless v2, in `dev`, `staging` and `prod`

If a migration ever needs an AWS-specific feature, that is a bug rather than a convention.

## Naming

```
0001_baseline.sql
0002_add_technology_relations.sql
0003_expand_resume_version_export_keys.sql
```

Four-digit zero-padded sequence, snake_case description, `.sql`. Sequential, never reused, never
renumbered — the number is the identity, and two branches must never produce the same one.

## How they are applied

| Where | How |
|---|---|
| Local | `pnpm migrate` against the compose database |
| CI | Against a throwaway PostgreSQL container, every PR |
| Cloud | The one-off **`migrate` ECS task**, run by the deployment pipeline before the new application version takes traffic |

**A snapshot is taken before every production migration**, automatically, by the pipeline.

## The two roles — this is the part that matters

There are two database roles, and the distinction is what makes row-level security a real boundary
rather than a convention:

| Role | Used by | Can it bypass RLS? |
|---|---|---|
| **owner** (`nextkin_owner`) | The `migrate` task only | Owns the tables, and FORCE RLS applies to it too. Migrations run as this |
| **application** (`nextkin_app`) | `web` and `worker`, through `withUser` and `withAnonymous` | **No.** Not the table owner, and has **no `BYPASSRLS`** |
| **maintenance** (`nextkin_maintenance`) | Purges and sweeps, through `withSystem` (every use reported) | Policies grant it all rows. It cannot insert user rows |
| **readonly** (`nextkin_readonly`) | Staff reads, through `withStaff` with a recorded reason | Sees rows only when a staff role is bound. It cannot write |

Because the application role does not own the tables, it **cannot** disable row-level security even
if the application code tried to. There is a test that proves this, and it is not optional.

## Expand and contract

Deployments are blue/green: the old and new application versions run at the same time during a
release. A migration that breaks the old version takes the site down mid-deploy.

So schema changes go in **two releases**, never one:

```
Release N      EXPAND    add the new column, nullable. Write to both old and new.
                         The old version still works because nothing it reads has changed.

Release N+1    CONTRACT  stop writing the old column, backfill, then drop it.
                         The old version is gone, so nothing depends on it any more.
```

**Never in a single migration:** dropping a column, renaming a column, adding a `NOT NULL` without a
default, or narrowing a type. Each of those breaks the version still serving traffic.

Renaming is the trap. `ALTER TABLE … RENAME COLUMN` looks harmless and is the fastest way to a broken
deploy. Add the new column, dual-write, backfill, switch reads, then drop — four steps across two
releases.

## Row-level security, on every user-owned table

The pattern, from the specification §9.4.2:

```sql
-- once per request, inside the transaction the request runs in
SELECT set_config('app.user_id', $1, true);   -- the Cognito sub, mapped to users.id
SELECT set_config('app.role',    $2, true);   -- 'user' | 'admin' | 'curator' | 'support'

-- and on every user-owned table
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes FORCE  ROW LEVEL SECURITY;

CREATE POLICY resumes_owner ON resumes
  USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR (org_id IS NOT NULL AND org_id IN (
          SELECT org_id FROM org_members
          WHERE user_id = current_setting('app.user_id', true)::uuid))
  );
```

Three things to notice:

1. **`FORCE ROW LEVEL SECURITY`, not just `ENABLE`.** Without `FORCE`, the table owner bypasses the
   policy — which is fine for the migrate role but means the policy is not doing what you think if
   ownership ever changes.
2. **`set_config(..., true)`** — the third argument makes it transaction-scoped. Session-scoped would
   leak one user's identity into the next request on a pooled connection. This is the single most
   dangerous thing to get wrong here.
3. **The `org_id` branch is dormant.** Every workspace-scoped table carries a **nullable `org_id`**
   from day one and every policy is written org-aware. Release 1 never sets it. That is what makes
   enterprise workspaces a migration later rather than a redesign — the requirement in specification
   §17.3.

## Writing a migration

1. One logical change per file. A migration that does two things is a migration you cannot half
   revert.
2. Wrap in a transaction unless something genuinely cannot be — `CREATE INDEX CONCURRENTLY` being the
   usual exception, and it needs its own file.
3. Every new user-owned table gets, in the same migration: `org_id uuid NULL`, `ENABLE` + `FORCE ROW
   LEVEL SECURITY`, its owner policy, and a row in the RLS test suite. A table that ships without a
   policy is readable by every user, and nothing will tell you.
4. Add indexes for the queries you are about to write, not speculatively. Check with `EXPLAIN` against
   seeded data — an index that looks obviously right on an empty table is often not used at all.
5. Long-running changes on a large table need the online approach. Aurora will happily lock a table
   and take the product down with it.

## Testing

Every migration must pass, before merge:

- [ ] Applies cleanly to an empty database
- [ ] Applies cleanly on top of the current production schema
- [ ] The RLS suite still passes — including cross-user reads on any new table
- [ ] The previous application version still works against the new schema (the expand half)
- [ ] `EXPLAIN` on affected queries against seeded data shows no sequential scan on a large table

## No down migrations

Forward only. A "down" migration that has never been run is fiction, and running one against
production data is how data gets lost.

To undo a change, write a new forward migration. To recover from a genuinely bad one, restore from the
pre-migration snapshot the pipeline took — that path is rehearsed as part of the M5 restore drill, so
it is known to work.

## The tables this will hold

Roughly thirty, from specification §10:

**Identity and profile** — `users`, `profiles`, `education`, `experience`, `experience_skills`,
`certifications`, `skills`, `profile_skills`

**Knowledge base** — `technologies`, `technology_relations`, `skill_trends` (P11: anonymous aggregates only, at least 10 users a row)

**Documents** — `resumes`, `resume_versions`, `job_descriptions`, `generations`, `ats_reports`,
`cover_letters`, `interview_question_sets`, `shared_reports` (P11: a redacted snapshot behind a hashed token)

**Jobs** — `jobs_cache`, `saved_jobs`

**Assistant** — `chat_sessions`, `chat_messages`

**Billing** — `billing_accounts`, `plans` (with `price_version`), `subscriptions`, `payments` (with a
sequential `invoice_number`), `webhook_events`, `usage_counters` (with `reserved`: P12-09 reserves at
start and charges on completion)

**Privacy and support (P12)** — `consents`, `data_exports`, `support_tickets`, `content_documents`
(the FAQ and legal documents, versioned)

**Admin and operations** — `prompt_templates`, `prompt_template_versions`, `audit_logs`,
`app_settings`, `job_provider_configs`, `resume_templates`, `prompt_evaluations` (P12-03: a prompt
version publishes only with a passing one)

Two of these carry rules worth knowing before you write them:

- **`resume_versions` is immutable.** Restoring an old version creates a *new* version. History is
  never rewritten, which is also why stored timeline-validation results are never retroactively
  changed by a later knowledge-base edit.
- **`audit_logs` is append-only**, exported nightly to an S3 bucket with Object Lock. There is no
  path — in the admin portal or anywhere else — that deletes a row.
