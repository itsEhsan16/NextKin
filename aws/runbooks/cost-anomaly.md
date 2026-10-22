# Cost anomaly

**Owner role:** Finance owner · **Acts with:** AI owner (AI spend), Backend on-call (infrastructure)

## Detect

- **AI spend:** every model call is traced with its cost (`ai_calls`). `GET /api/v1/admin/analytics`
  shows the totals. In the cloud: a daily spend alarm and AWS Cost Anomaly Detection (X-11).
- **Locally:** `AI_DAILY_CAP_USD` stops a developer's live calls at the cap (D-23).
- **Infrastructure:** AWS Budgets alerts at 50%, 80% and 100% of the monthly budget (X-03).
- **Payment provider:** fees and disputes in the provider dashboard (X-13).

## Steps

1. **Find what moved.** Group `ai_calls` by stage, model, tag (user, eval, developer) and user for
   the window. A cost jump with flat call volume is a price or model change, so check `ai.prices`
   and `ai.routing`. A volume jump is usage or abuse.
2. **Abuse by a few accounts.** Quotas are reserved atomically and charged on completion, so no
   account can pass its plan's cap. If one is gaming the free tier with many accounts, suspend them
   (`POST /admin/users/{id}/suspend`) and treat it as a [security incident](security-incident.md)
   if it is organised.
3. **A bug: a retry loop or an oversized input.** Turn the feature off with its kill switch. Check
   the stage's `inputBudgetTokens` in `ai.routing`, and look in the DLQs for a message that keeps
   failing ([DLQ replay](dlq-replay.md)).
4. **Evaluations.** Prompt evaluations are tagged `eval` and billed. A loop of evaluations shows up
   under that tag, and the AI owner stops it.
5. **Lower the cap if needed.** `PATCH /admin/plans/{id}/quotas` changes per-plan quotas without a
   deploy, and it is audited. Tell users through the Comms owner before reducing a paid plan's
   quota.
6. **Record** the cause and the cost in the review, and add an alarm for whatever was not caught.
