# DLQ replay

**Owner role:** Backend on-call

Every work queue has a dead-letter queue: `generation-priority`, `generation-standard` and
`maintenance`, each with a `-dlq`. A message lands there after the queue's receive limit, or at
once if it fails schema validation (poison). Dead letters mean work that did not happen: a user's
generation, an export, a webhook, a scan.

## Detect

- Locally: `pnpm dlq list`. Cloud (X-11): the DLQ-depth alarm (depth above 0 for 5 minutes).
- Generations whose message was lost or dead-lettered are also failed by the 3-minute sweep as
  `timed_out`, with the quota released. The user sees a retryable failure, not a hang.

## Steps

1. **Look before you replay.**
   ```sh
   pnpm dlq list                          # every DLQ
   pnpm dlq list -- --queue maintenance
   ```
   Each entry shows the message type, its ids (never a body), its receive count, when it was sent,
   and a digest of its FIFO group. Entries with the same digest belong to one user.
2. **Find the cause.** Search the logs for the ids (the correlation id is the envelope id). A
   replay before the fix just dead-letters again.
   - `unparseable` means the body failed validation. That is usually a version mismatch after a
     deploy or rollback.
   - One type failing for everyone means a dependency is down. Check `/api/v1/health/features`.
   - One user's group failing means bad data for that user. Fix it, or leave the message for
     support.
3. **Dry run.**
   ```sh
   pnpm dlq:replay -- --queue generation-standard
   ```
4. **Replay.**
   ```sh
   pnpm dlq:replay -- --queue generation-standard --apply
   pnpm dlq:replay -- --queue maintenance --type billing.webhook --apply
   ```
   - A **generation** is reset to `queued` with its checkpoint kept, and announced again through
     the outbox. It resumes from its first incomplete stage, exactly like a user's retry. A run that
     has since finished, or was deleted, is removed from the DLQ, not replayed.
   - **Other messages** (scans, parses, exports, webhooks, maintenance) re-check their own row's
     state, so a replayed message whose work already happened changes nothing.
   - **Unparseable bodies** stay, so a person can look at them. Add `--drop-poison --apply` only
     once you know what they were.
5. **Confirm.** `pnpm dlq list` shows the DLQ empty; the replayed generations reach `ready`.

## Notes

- Replay never charges a user twice. Quota is reserved at start and committed once, on completion.
- Locally ElasticMQ keeps queues in memory, so a restart empties the DLQs. The outbox republishes
  anything not yet sent, and the sweep fails runs whose message was lost (drill record
  [2026-10-16](../drills/2026-10-16.md)). SQS keeps messages for 14 days (cloud, X-05).
