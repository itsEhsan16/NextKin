import type {
  Generation,
  GenerationKind,
} from "@nextkin/shared/models/generation";
import type { GenerationRequest } from "@nextkin/shared/schemas/generation";
import { sql } from "kysely";
import type { Database, Identity, Tx } from "../db/database";
import { errors } from "../http/errors";
import { enqueue } from "../outbox/outbox";
import {
  appendEvent,
  type EventPublisher,
  type PublishedEvent,
} from "../pipeline/events";
import {
  failGeneration,
  FAILURE_MESSAGE,
  lockGeneration,
} from "../pipeline/runner";
import { toSnapshot, type GenerationRow } from "../pipeline/snapshot";
import { loadFacts } from "../pipeline/facts";
import { PIPELINES } from "../pipeline/pipelines";
import type { RunKind } from "../pipeline/stages";
import { generationGroup, type QueueName } from "../queue/envelope";
import { reserveRun } from "./quotas";
import { requireAiConsent } from "./consent";
import { asOfNow } from "./tailorBase";
import { addProfileSkills, prepareTailor } from "./tailorStart";

/**
 * Generations (spec §11 `/api/v1/generations`; ImBackendImplementationPlan P6-05, P6-15).
 *
 * - **start** is idempotent: `UNIQUE (user_id, idempotency_key)` means a retried POST returns the
 *   run it already started, and the run and its queue message commit together (outbox), so neither
 *   exists without the other. Pro runs go to the priority queue, which workers drain first.
 * - **retry** resumes a failed run from its first incomplete stage (the checkpoint is kept).
 * - **cancel** ends a queued run at once; a running one at its next stage boundary.
 * - **sweep** fails anything still unfinished after GENERATION_TIMEOUT_SECONDS (3 minutes).
 */

/** Kinds that produce a document, and how it is filed (V2 §7.11). */
const DOCUMENT_KINDS: Partial<
  Record<
    GenerationKind,
    {
      label: string;
      docType: "resume" | "cover_letter";
      source: "generated" | "zero_resume";
    }
  >
> = {
  resume: { label: "Resume", docType: "resume", source: "generated" },
  zero_resume: {
    label: "Zero Resume draft",
    docType: "resume",
    source: "zero_resume",
  },
  cover_letter: {
    label: "Cover letter",
    docType: "cover_letter",
    source: "generated",
  },
};

const stagesOf = (kind: string) => PIPELINES[kind as RunKind].stages.length;
export const snapshotOf = (row: GenerationRow): Generation =>
  toSnapshot(row, stagesOf(row.kind));

async function queueFor(tx: Tx, userId: string): Promise<QueueName> {
  const pro = await tx
    .selectFrom("subscriptions")
    .select("plan_id")
    .where("user_id", "=", userId)
    .where("status", "in", ["active", "trialing"])
    .where("plan_id", "like", "pro%")
    .executeTakeFirst();
  return pro ? "generation-priority" : "generation-standard";
}

export async function announce(
  tx: Tx,
  row: GenerationRow,
  correlationId: string | null,
): Promise<void> {
  await enqueue(tx, {
    queue: await queueFor(tx, row.user_id),
    groupId: generationGroup(row.user_id, row.id),
    type: "generation.run",
    payload: { generationId: row.id, userId: row.user_id },
    correlationId,
  });
}

export async function startGeneration(
  db: Database,
  identity: Identity,
  input: GenerationRequest,
  options: { idempotencyKey: string; correlationId: string | null },
): Promise<{ generation: Generation; created: boolean }> {
  return db.withUser(identity, async (tx) => {
    const existing = await tx
      .selectFrom("generations")
      .selectAll()
      .where("user_id", "=", identity.userId)
      .where("idempotency_key", "=", options.idempotencyKey)
      .executeTakeFirst();
    if (existing) return { generation: snapshotOf(existing), created: false };
    await requireAiConsent(tx, identity.userId); // P12-12: no AI stage without consent

    // BUILD 04c: skills the user said are true go on the profile first, so the run's facts have them.
    await addProfileSkills(tx, identity.userId, input.build?.added ?? []);
    // An interview set or a cover letter about a resume reads the JD that resume was made for
    // (P11-08; toreview §125: Home's Cover Letter starts from the resume alone).
    if (
      (input.kind === "interview" || input.kind === "cover_letter") &&
      input.sourceResumeId &&
      !input.jdId
    ) {
      const linked = await tx
        .selectFrom("resumes")
        .select("job_description_id")
        .where("id", "=", input.sourceResumeId)
        .executeTakeFirst();
      if (linked?.job_description_id)
        input = { ...input, jdId: linked.job_description_id };
    }
    // The run reads one profile and one "present" from start to finish (P9-03, G12). A tailored
    // run's facts are the lines of the resume it starts from (toreview §110.3).
    const asOf = asOfNow();
    const tailored = input.tailoring
      ? await prepareTailor(tx, identity.userId, {
          kind: input.kind,
          jdId: input.jdId,
          baseResumeId: input.baseResumeId,
          tailoring: input.tailoring,
          asOf,
        })
      : null;
    const snapshot =
      tailored?.snapshot ?? (await loadFacts(tx, identity.userId));

    const inserted = await tx
      .insertInto("generations")
      .values({
        user_id: identity.userId,
        kind: input.kind,
        input: JSON.stringify({
          ...input,
          ...(tailored ? { tailor: tailored.tailor } : {}),
          snapshot,
          asOf,
        }),
        idempotency_key: options.idempotencyKey,
        ...(input.jdId ? { job_description_id: input.jdId } : {}),
        ...(input.sourceResumeId
          ? { source_resume_id: input.sourceResumeId }
          : {}),
      })
      .onConflict((oc) =>
        oc.columns(["user_id", "idempotency_key"]).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
    if (!inserted) {
      const raced = await tx
        .selectFrom("generations")
        .selectAll()
        .where("user_id", "=", identity.userId)
        .where("idempotency_key", "=", options.idempotencyKey)
        .executeTakeFirstOrThrow();
      return { generation: snapshotOf(raced), created: false };
    }

    // P12-09: the run's quota slots, reserved now and charged on completion; past a cap this throws
    // PLAN_LOCKED and the whole start rolls back, before any work begins (§13.5).
    const reserved = await reserveRun(
      tx,
      identity.userId,
      input.kind,
      { sourceResumeId: input.sourceResumeId ?? null },
      inserted.id,
    );
    let row = await tx
      .updateTable("generations")
      .set({ quota_reservation: JSON.stringify(reserved) })
      .where("id", "=", inserted.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // The document the run will fill exists from the start, so the app can show it in flight.
    const docKind = DOCUMENT_KINDS[input.kind];
    if (docKind) {
      const jdTitle = input.jdId
        ? await tx
            .selectFrom("job_descriptions")
            .select(["extracted", "edited"])
            .where("id", "=", input.jdId)
            .executeTakeFirst()
        : undefined;
      const fromJd =
        ((jdTitle?.edited as { title?: string } | null)?.title ??
          (jdTitle?.extracted as { title?: string | null } | null)?.title) ||
        null;
      const resume = await tx
        .insertInto("resumes")
        .values({
          user_id: identity.userId,
          title: (
            input.title ??
            (fromJd ? `${docKind.label} — ${fromJd}` : docKind.label)
          ).slice(0, 200),
          doc_type: docKind.docType,
          source: docKind.source,
          ...(input.jdId ? { job_description_id: input.jdId } : {}),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      row = await tx
        .updateTable("generations")
        .set({ resume_id: resume.id })
        .where("id", "=", inserted.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    await announce(tx, row, options.correlationId);
    return { generation: snapshotOf(row), created: true };
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getGeneration(
  db: Database,
  identity: Identity,
  id: string,
): Promise<Generation> {
  if (!UUID.test(id)) throw errors.notFound("generation"); // not a 500 from the uuid cast
  // A section run (P10-02) is read through its resume, never as an app generation.
  const row = await db.withUser(identity, (tx) =>
    tx
      .selectFrom("generations")
      .selectAll()
      .where("id", "=", id)
      .where("kind", "<>", "section")
      .executeTakeFirst(),
  );
  if (!row) throw errors.notFound("generation");
  return snapshotOf(row);
}

export async function listGenerations(
  db: Database,
  identity: Identity,
  limit = 50,
): Promise<Generation[]> {
  const rows = await db.withUser(identity, (tx) =>
    tx
      .selectFrom("generations")
      .selectAll()
      .where("user_id", "=", identity.userId)
      .where("kind", "<>", "section")
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute(),
  );
  return rows.map(snapshotOf);
}

/** The most recent unfinished run, or null. */
export async function activeGeneration(
  db: Database,
  identity: Identity,
): Promise<Generation | null> {
  const row = await db.withUser(identity, (tx) =>
    tx
      .selectFrom("generations")
      .selectAll()
      .where("user_id", "=", identity.userId)
      .where("status", "not in", ["ready", "failed"])
      .where("kind", "<>", "section")
      .orderBy("created_at", "desc")
      .executeTakeFirst(),
  );
  return row ? snapshotOf(row) : null;
}

async function mutate(
  db: Database,
  identity: Identity,
  publisher: EventPublisher,
  id: string,
  change: (
    tx: Tx,
    row: GenerationRow,
  ) => Promise<{ row: GenerationRow; events: PublishedEvent[] }>,
): Promise<Generation> {
  if (!UUID.test(id)) throw errors.notFound("generation");
  const { row, events } = await db.withUser(identity, async (tx) => {
    const current = await lockGeneration(tx, id);
    if (!current) throw errors.notFound("generation");
    return change(tx, current);
  });
  for (const event of events) await publisher.publish(id, event);
  return snapshotOf(row);
}

/** Resumes a failed run from its first incomplete stage. A cancelled run can be retried too. */
export function retryGeneration(
  db: Database,
  identity: Identity,
  publisher: EventPublisher,
  id: string,
  correlationId: string | null,
): Promise<Generation> {
  return mutate(db, identity, publisher, id, async (tx, row) => {
    if (row.status !== "failed")
      throw errors.conflict("Only a failed run can be retried.");
    // Its slots went back when it failed, so a retry reserves again (and may meet the cap).
    const reserved =
      row.kind === "section"
        ? []
        : await reserveRun(
            tx,
            row.user_id,
            row.kind as Parameters<typeof reserveRun>[2],
            { sourceResumeId: row.source_resume_id },
            row.id,
          );
    const updated = await tx
      .updateTable("generations")
      .set({
        status: "queued",
        finished_at: null,
        error_code: null,
        error_message: null,
        cancel_requested_at: null,
        current_stage: null,
        started_at: sql`now()`,
        quota_reservation: JSON.stringify(reserved),
        quota_released_at: null,
      })
      .where("id", "=", row.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await announce(tx, updated, correlationId);
    return { row: updated, events: [] };
  });
}

/** Queued: cancelled now. Running: flagged, and the runner ends it at the next stage boundary. */
export function cancelGeneration(
  db: Database,
  identity: Identity,
  publisher: EventPublisher,
  id: string,
): Promise<Generation> {
  return mutate(db, identity, publisher, id, async (tx, row) => {
    if (row.status === "ready" || row.status === "failed")
      return { row, events: [] };
    if (row.status === "queued") {
      await tx
        .updateTable("generations")
        .set({ cancel_requested_at: sql`now()` })
        .where("id", "=", row.id)
        .execute();
      const event = await failGeneration(
        tx,
        row,
        "cancelled",
        FAILURE_MESSAGE.cancelled,
        stagesOf(row.kind),
      );
      const after = await tx
        .selectFrom("generations")
        .selectAll()
        .where("id", "=", row.id)
        .executeTakeFirstOrThrow();
      return { row: after, events: event ? [event] : [] };
    }
    const flagged = await tx
      .updateTable("generations")
      .set({ cancel_requested_at: sql`now()` })
      .where("id", "=", row.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return { row: flagged, events: [] };
  });
}

/**
 * The maintenance sweep (M2-04, R-10): any run still unfinished `timeoutSeconds` after it started
 * (or was retried) is failed with a plain reason and its event, so nothing hangs and the client can
 * offer a retry. Runs as the system role across all users.
 */
export async function sweepStuckGenerations(
  db: Database,
  publisher: EventPublisher,
  timeoutSeconds: number,
): Promise<number> {
  // Found as the system (across users), then failed one by one as each run's owner, under RLS:
  // the system role may read and update user rows but never writes their events.
  const stuck = await db.withSystem(
    "generations: find runs past the timeout",
    (tx) =>
      tx
        .selectFrom("generations")
        .select(["id", "user_id"])
        .where("status", "not in", ["ready", "failed"])
        .where(
          sql<boolean>`coalesce(started_at, created_at) < now() - make_interval(secs => ${timeoutSeconds})`,
        )
        .orderBy("created_at")
        .limit(500)
        .execute(),
  );
  let failed = 0;
  for (const { id, user_id } of stuck) {
    const event = await db.withUser(
      { userId: user_id, role: "user" },
      async (tx) => {
        const row = await lockGeneration(tx, id);
        // Re-checked under the lock: it may have finished since it was found.
        if (!row || row.status === "ready" || row.status === "failed")
          return null;
        const started = new Date(row.started_at ?? row.created_at).getTime();
        if (Date.now() - started < timeoutSeconds * 1000) return null;
        return failGeneration(
          tx,
          row,
          "timed_out",
          FAILURE_MESSAGE.timed_out,
          stagesOf(row.kind),
        );
      },
    );
    if (event) {
      failed++;
      await publisher.publish(id, event);
    }
  }
  return failed;
}

export { eventsAfter, lastTerminalEventId } from "./generationEvents";
export { appendEvent };
