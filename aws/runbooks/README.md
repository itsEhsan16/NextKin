# Runbooks

What to do when something goes wrong, written before it does (ImBackendImplementationPlan P13-05).
Each runbook names an **owner role**, not a person. The table below maps roles to people. Fill it
in before the first shared environment exists (X-03), and keep it current.

The runbooks are written for the local stack, which is what exists today, and for the cloud, where
the cloud step is already known. A cloud step that depends on a Connect item is marked
**(cloud, X-nn)**. Until that item lands it is a plan, not a tested procedure.

## Roles

| Role                     | Owns                                                                  | Person |
| ------------------------ | --------------------------------------------------------------------- | ------ |
| Incident commander (IC)  | Declares and closes incidents, decides, keeps the timeline            | TBD    |
| Backend on-call          | First response: the API, the worker, queues, the data stores          | TBD    |
| Security lead            | Security incidents, key rotation, breach notification decisions      | TBD    |
| Data owner               | Backups, restores, migrations, anything that can lose data            | TBD    |
| AI owner                 | Model routing, prompts, evaluations, AI spend                         | TBD    |
| Comms owner              | Status page, in-app banner wording, user and client messages          | TBD    |
| Finance owner            | Provider bills, payment-provider disputes, cost anomalies             | TBD    |

One person may hold several roles while the team is small. The IC and the person doing the fix
should not be the same person in a Sev 1.

## Severity

| Sev | Meaning                                                                   | Response                          |
| --- | ------------------------------------------------------------------------- | --------------------------------- |
| 1   | Data loss or exposure, a security breach, or the product down for everyone | Now; IC declared; Security lead if exposure |
| 2   | A core flow down (sign-in, generation, export, payment) or degraded for many | Within the hour                   |
| 3   | A degraded mode active (the in-app banner shows), or one user blocked      | Same working day                  |

## Index

| Runbook                                          | Owner role        | When                                                 |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------- |
| [Deploy and rollback](deploy-and-rollback.md)    | Backend on-call   | Every release; a bad release                         |
| [DLQ replay](dlq-replay.md)                      | Backend on-call   | A dead-letter queue is not empty                     |
| [AI failover](ai-failover.md)                    | AI owner          | The `ai` degraded mode is on; provider outage        |
| [Restore](restore.md)                            | Data owner        | Data loss or corruption; the quarterly drill         |
| [Key rotation](key-rotation.md)                  | Security lead     | Scheduled rotation; a key may have leaked            |
| [Security incident](security-incident.md)        | Security lead     | Suspected breach, exposure or abuse                  |
| [Cost anomaly](cost-anomaly.md)                  | Finance owner     | Spend above forecast; a spend alarm                  |

## Common tools

- **Health:** `GET /api/v1/health` (shallow), `/api/v1/health/deep` (dependencies) and
  `/api/v1/health/features` (degraded modes: `ai`, `jobs`, `payments`, `email`). A degraded
  capability also shows a banner in both apps.
- **Kill switches:** `app_settings` keys `features.<assistant|teaser|job_search>.enabled = false`.
  This is a settings change, not a deploy, and takes effect within 10 seconds.
- **Dead letters:** `pnpm dlq list` and `pnpm dlq:replay` (see [DLQ replay](dlq-replay.md)).
- **Audit:** `GET /api/v1/admin/audit` and `/admin/audit/export` (CSV).
- **Drill records:** [`aws/drills/`](../drills/). Each drill writes a dated file with what it
  measured.

After any Sev 1 or Sev 2, write a blameless review within five working days. It records the
timeline, the impact, the cause, what went well and the follow-up tasks. Link it from the incident.
