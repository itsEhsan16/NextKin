# AI failover

**Owner role:** AI owner · **Backup:** Backend on-call

## Detect

- `GET /api/v1/health/features` shows `ai` degraded, and both apps show the banner. The gateway
  marks the signal when every provider in a stage's route fails with an outage-class error (rate
  limit, overload, timeout, unavailable, auth, server error). Its first success clears it. The
  signal expires on its own 5 minutes after the last failure.
- Generations fail as retryable, and the user's quota is released. The assistant answers 503.
- The per-call trace (`ai_calls`) shows the provider, the model and the error class of every call.

## What the product does on its own

- Each stage tries the providers in its `ai.routing` entry, in order. A provider family without an
  adapter is skipped. Today only `claude` exists. `bedrock` and `openai` arrive with X-10.
- Retries are jittered and bounded, and a run that cannot finish fails cleanly with its quota
  released. Nothing is charged for a failed run.

## Steps

1. **Confirm it is the provider.** Check the provider's status page and `ai_calls` for the error
   class. An `auth` class means our key, not their outage: go to [Key rotation](key-rotation.md).
2. **Fail over by settings, not by deploy.** Edit `app_settings` key `ai.routing`. Put the healthy
   family first in the affected stages, or add it as a second step. Model ids live only in that
   setting, never in code.
   - Bump `version` in the same edit. A re-seed replaces an older version, never a newer one.
   - Change routing only to models that have passed the golden set. Failing over to an unevaluated
     model breaks G16. If none is available, stay degraded and say so.
3. **Shed load if needed.** Turn the assistant off with `features.assistant.enabled = false`, which
   gives the named degraded response. Generation stays on: it fails cleanly and refunds.
4. **Tell users.** The banner is automatic. The Comms owner updates the status page (cloud).
5. **Recover.** When the provider is healthy, restore the original routing (and `version` + 1).
   Then replay any dead-lettered generations ([DLQ replay](dlq-replay.md)). Most will already have
   been failed by the sweep, and users retry them.

## Locally

`LLM_ROUTE=fake` or `recorded` runs with no provider at all. The drill that forces each degraded
mode is `test/integration/degradedP13.int.test.ts`.
