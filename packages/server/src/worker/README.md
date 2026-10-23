# The async backbone and the AI layer (P6)

How slow work runs in the background, and how a stage calls a model.

**Audience:** engineers building pipelines (P9) and anyone running or debugging the worker.

## The path of one run

```
POST /api/v1/generations (Idempotency-Key)
  └─ one transaction: generations row + outbox row            services/generations.ts, outbox/
outbox relay (worker, one leader)  ─▶ SQS FIFO / ElasticMQ      outbox/outbox.ts, queue/
  priority queue (Pro) drained before standard; group user_id#slot (≤ 2 runs per user)
worker consumer (heartbeat, backoff, DLQ after 5)              worker/consumer.ts
  └─ pipeline runner: stage → checkpoint transaction → next     pipeline/runner.ts
       each stage's AI call goes through the gateway            ai/gateway.ts
       events appended in the same transaction, published on Valkey gen:<id>
       terminal success transaction: ready + quota charge (once) + activity
GET /api/v1/generations/:id/events (SSE)                       http/routes/generations.ts
  replay from generation_events after Last-Event-ID, then live via one subscriber per process
```

## Guarantees and where they are proved

| Guarantee | Proved by |
|---|---|
| A run and its message commit together; a rolled-back write sends nothing | `worker.int.test.ts` (outbox) |
| A relay killed between publishing and marking loses nothing and delivers once | `worker.int.test.ts` (dedup by outbox id) |
| A duplicate `POST /generations` starts one run | `pipeline.int.test.ts`, `generationsApi.int.test.ts` |
| At most two runs per user at a time; a Pro run jumps ten Free ones | `worker.int.test.ts` |
| A crash at any stage boundary, before or after the commit, resumes correctly and charges once | the crash-injection matrix in `pipeline.int.test.ts` |
| SIGTERM releases in-flight work; another worker resumes it | `worker.int.test.ts`, `queue.test.ts` |
| Poison dead-letters in seconds and moves the DLQ depth | `worker.int.test.ts` |
| Nothing stays unfinished past 3 minutes (the sweep) | `pipeline.int.test.ts`, the burst test |
| Two schedulers never enqueue the same run | `worker.int.test.ts` |
| SSE reconnects at the right event; heartbeats keep an idle stream open | `generationsApi.int.test.ts` |

## Writing a stage (P9)

- **A stage is idempotent.** It may run again after a crash, and only its committed output counts.
- **Its input is PII-free.** Type it with `StageInput<T>`, which refuses a type with a contact field.
  The gateway also checks at run time. Contact details join the document at render time only (G5).
- **Untrusted text (a JD, resume text) goes in `untrusted`,** never in `system`. The gateway redacts
  contact details from it, fits it to the stage's token budget, and fences it as data (G9).
- **Structured output** is a zod schema handed to `gateway.extract`. The model gets a strict JSON
  schema; the answer is validated, with one corrective retry.
- **Model ids live only in `app_settings` `ai.routing`.** Changing a stage's model, or its failover
  chain, is a settings change with no deploy. Prices live in `ai.prices`.
- **The model proposes; code decides (G14).** Checks and scores are deterministic stages.

## Running locally

| Variable | Effect |
|---|---|
| `LLM_ROUTE=recorded` (default) | Replays `fixtures/ai/*.json` by request hash. No key, no network; what CI uses |
| `LLM_ROUTE=fake` | Deterministic, schema-valid answers |
| `LLM_ROUTE=claudeDirect` + `ANTHROPIC_API_KEY` | Live calls with your own key (D-23), synthetic data only, capped at `AI_DAILY_CAP_USD` per `AI_DEVELOPER` per day, tagged `dev` |
| `AI_RECORD=true` (with `claudeDirect`) | Live calls, each answer written as a fixture |
| `WORKER_CONCURRENCY` | Runs one worker process takes at once (default 4) |
| `GENERATION_TIMEOUT_SECONDS` | The sweep's limit (default 180) |

- `pnpm worker` runs the worker with live reload.
- `pnpm dlq list` shows what is dead-lettered (ids only); `pnpm dlq:replay` is a dry run, `-- --apply` replays. A generation resumes
  from its checkpoint, exactly as a user's retry does.
- **The hello-world fixture was recorded from the `fake` provider,** because no key was set
  (`source: "fake"` in the file). Re-record it against the live API with
  `LLM_ROUTE=claudeDirect AI_RECORD=true`, and re-record whenever the hello prompt changes: the hash
  covers the prompt.

## P6-14 finding: SSE on Expo Go (2026-10-11)

**From the SDK 57 docs** (docs.expo.dev/versions/v57.0.0/sdk/expo):
- `expo/fetch` is a WinterCG-compliant fetch.
- It is installed as the global `fetch` on Android and iOS.
- It supports streaming response bodies (`response.body.getReader()`).
- It is "Included in Expo Go".
- `EXPO_PUBLIC_USE_RN_FETCH=1` opts back out to React Native's fetch, which cannot stream.

**Built:** `packages/shared/src/repos/http/sse.ts` (`readServerSentEvents`) reads the stream with
`fetch` alone. `EventSource` is not used, because it cannot send mobile's bearer token. It is proved
against this server's real SSE route in `generationsApi.int.test.ts`.

**Reproduction on a device** (pending: needs a phone):
1. Run the stack and `pnpm web:lan`, with the mobile `.env.local` from
   `aws/setup/04-local-development.md`.
2. Start a run: `POST /api/v1/generations` with a bearer token and an Idempotency-Key.
3. In the app, call `readServerSentEvents(await fetch(url, { headers }), log)` against
   `/api/v1/generations/<id>/events`.
4. Expect seven events ending `completed`. Kill the network mid-stream, reconnect with
   `Last-Event-ID`, and expect the remaining events only.
5. Repeat on an EAS development build.

**If it fails on either platform:** mobile's HTTP `subscribe` polls `GET /generations/:id` every
second instead (§9.3's fallback), which the server already serves.
