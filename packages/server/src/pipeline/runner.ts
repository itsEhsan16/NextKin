import { GENERATION_KIND_LABEL, type GenerationKind } from '@nextkin/shared/models/generation';
import { sql } from 'kysely';
import type { AiGateway } from '../ai/gateway';
import type { LatexCompiler } from '../export/latex/compile';
import { ContactDataError } from '../ai/pii';
import { LlmError } from '../ai/types';
import type { Database, Tx } from '../db/database';
import type { Logger } from '../observability/logger';
import { askAfterRun } from '../services/applications';
import { activePrompt, promptVersion, type PromptVersion } from '../services/prompts';
import { notifyRunFailed, notifyRunReady } from '../services/notifications';
import { commitRun, releaseRun } from '../services/quotas';
import { hasAiConsent } from '../services/consent';
import { appendEvent, type EventPublisher, type PublishedEvent } from './events';
import { readCheckpoint, toSnapshot, type GenerationRow } from './snapshot';
import { PIPELINES } from './pipelines';
import { StageError, type PipelineDef, type RunKind } from './stages';

/**
 * The pipeline runner (ImBackendImplementationPlan P6-04, P6-05; old plan M2-02, R-07).
 *
 * - **Checkpoints.** After each stage, one transaction writes the stage's output into `checkpoint`,
 *   advances `current_stage` and `status`, appends to `stage_log` and records the event. A
 *   redelivered message resumes at the first stage the checkpoint does not hold.
 * - **Quota is charged in the terminal success transaction only** (G2), guarded by
 *   `quota_charged_at`, so no crash or redelivery can charge twice and a failed or cancelled run
 *   charges nothing.
 * - **Cancel** is a flag checked at every stage boundary; the run ends as failed / Cancelled.
 * - **Failures.** A transient failure (provider overload, rate limit, refusal) is thrown back to the
 *   worker, which redelivers with backoff; on the last allowed receive the run is failed with a
 *   plain reason before the message dead-letters. A permanent failure fails the run at once.
 *
 * Every database access is under RLS as the run's owner (withUser).
 */

export const MAX_RECEIVES = 5; // the queues' maxReceiveCount

/** Test seam (the crash-injection matrix): called inside each boundary transaction, and after it commits. */
export interface RunnerHooks {
  beforeCommit?(boundary: string): void;
  afterCommit?(boundary: string): void;
}

export interface RunnerDeps {
  db: Database;
  gateway: AiGateway;
  latex?: LatexCompiler;
  publisher: EventPublisher;
  log: Logger;
  pipelines?: Record<RunKind, PipelineDef>;
}

export interface RunMessage {
  generationId: string;
  userId: string;
  correlationId: string | null;
  receiveCount: number;
}

export type RunOutcome = 'completed' | 'failed' | 'skipped';

// A section regeneration is an edit of a document already paid for: no charge, no activity entry.
// An interview run writes its own entry with its set (persist), so it links to the set.
const QUOTA_METRIC: Record<RunKind, 'generation' | 'cover_letter' | 'zero_resume' | 'ats_check' | 'interview_set' | null> = {
  section: null,
  resume: 'generation',
  cover_letter: 'cover_letter',
  zero_resume: 'zero_resume',
  ats_check: 'ats_check',
  interview: 'interview_set',
};
const ACTIVITY_KIND: Record<RunKind, string | null> = { section: null, resume: 'generation', cover_letter: 'cover_letter', zero_resume: 'generation', ats_check: 'ats_check', interview: null };

/** Plain-language reasons, safe to show (the envelope rule: no internals). */
export const FAILURE_MESSAGE = {
  cancelled: 'Cancelled.',
  timed_out: 'This took too long and was stopped. Try again.',
  provider: 'We couldn’t reach our writing service. Try again in a moment.',
  dead_lettered: 'We couldn’t finish this. Try again.',
  invalid: 'Something in this request can’t be processed. Check it and try again.',
  consent: 'Agree to how NextKin uses AI, then try again.',
} as const;

export async function lockGeneration(tx: Tx, id: string): Promise<GenerationRow | undefined> {
  return tx.selectFrom('generations').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
}

/** Ends a run as failed, with its event. A run already finished is left alone. */
export async function failGeneration(tx: Tx, row: GenerationRow, code: string, message: string, stageCount: number): Promise<PublishedEvent | null> {
  if (row.status === 'ready' || row.status === 'failed') return null;
  // A failed, cancelled or timed-out run costs nothing (G2): its reservation goes back.
  await releaseRun(tx, row);
  const updated = await tx
    .updateTable('generations')
    .set({ status: 'failed', finished_at: sql`now()`, error_code: code, error_message: message, current_stage: null })
    .where('id', '=', row.id)
    .returningAll()
    .executeTakeFirstOrThrow();
  // A run the candidate stopped, or one waiting on their consent, is not news to them.
  if (code !== 'cancelled' && code !== 'consent_required') await notifyRunFailed(tx, updated);
  return appendEvent(tx, row.id, row.user_id, 'failed', row.current_stage, toSnapshot(updated, stageCount));
}

export function createRunner(deps: RunnerDeps, hooks: RunnerHooks = {}) {
  const { db, log, publisher } = deps;
  const pipelines = deps.pipelines ?? PIPELINES;

  /** One boundary transaction under RLS as the owner, with the crash hooks around its commit. */
  async function boundary(message: RunMessage, name: string, fn: (tx: Tx) => Promise<PublishedEvent[]>): Promise<void> {
    const events = await db.withUser({ userId: message.userId, role: 'user' }, async (tx) => {
      const out = await fn(tx);
      hooks.beforeCommit?.(name);
      return out;
    });
    hooks.afterCommit?.(name);
    for (const event of events) await publisher.publish(message.generationId, event);
  }

  async function run(message: RunMessage): Promise<RunOutcome> {
    // Written inside the claim transaction below; an object so the reads after it are not narrowed away.
    const claim: { outcome: RunOutcome; pipeline: PipelineDef | null; prompt: PromptVersion | null } = { outcome: 'skipped', pipeline: null, prompt: null };

    // The prompt tables are internal (readable by the system role, not by users), so the versions are
    // read on their own: the ones pinned on the run, else each template's active version. The
    // primary template is pinned in its column; the others in `provenance.prompts`.
    const peek = await db.withUser({ userId: message.userId, role: 'user' }, (tx) =>
      tx.selectFrom('generations').select(['kind', 'prompt_template_version_id', 'provenance']).where('id', '=', message.generationId).executeTakeFirst(),
    );
    if (!peek) return 'skipped';
    const peekDef = pipelines[peek.kind as RunKind];
    const template = peekDef.promptTemplate;
    const pinnedIds = (peek.provenance as { prompts?: Record<string, string> } | null)?.prompts ?? {};
    const { resolved, extra } = await db.withSystem('pipeline: read the prompt versions for a run', async (tx) => {
      const primary = peek.prompt_template_version_id ? await promptVersion(tx, peek.prompt_template_version_id) : await activePrompt(tx, template);
      const others: Record<string, PromptVersion> = {};
      for (const name of peekDef.prompts ?? []) {
        if (name === template) continue;
        const pinnedId = pinnedIds[name];
        others[name] = pinnedId ? await promptVersion(tx, pinnedId) : await activePrompt(tx, name);
      }
      return { resolved: primary, extra: others };
    });
    const prompts: Record<string, PromptVersion> = { [template]: resolved, ...extra };

    // 1. Claim the run: count the attempt, pin the prompt version, mark the first stage started.
    await boundary(message, 'start', async (tx) => {
      const row = await lockGeneration(tx, message.generationId);
      if (!row || row.status === 'ready' || row.status === 'failed') return [];
      const pipeline = (claim.pipeline = pipelines[row.kind as RunKind]);
      // P12-12: checked again at every claim, so consent withdrawn while queued stops the run.
      if (!(await hasAiConsent(tx, row.user_id))) {
        claim.outcome = 'failed';
        const event = await failGeneration(tx, row, 'consent_required', FAILURE_MESSAGE.consent, pipeline.stages.length);
        return event ? [event] : [];
      }
      if (row.cancel_requested_at) {
        claim.outcome = 'failed';
        const event = await failGeneration(tx, row, 'cancelled', FAILURE_MESSAGE.cancelled, pipeline.stages.length);
        return event ? [event] : [];
      }
      const prompt = (claim.prompt = resolved);
      const next = pipeline.stages.find((stage) => !readCheckpoint(row).completed.includes(stage.name));
      const started = row.status === 'queued' && next;
      const updated = await tx
        .updateTable('generations')
        .set({
          attempt: row.attempt + 1,
          started_at: row.started_at ?? sql`now()`,
          prompt_template_version_id: prompt.id,
          provenance: JSON.stringify({
            ...((row.provenance as object | null) ?? {}),
            prompts: Object.fromEntries(Object.entries(prompts).map(([name, version]) => [name, version.id])),
          }),
          ...(started ? { status: next.status, current_stage: next.name } : {}),
        })
        .where('id', '=', row.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      claim.outcome = 'completed';
      return started ? [await appendEvent(tx, row.id, row.user_id, 'stage_started', next.name, toSnapshot(updated, pipeline.stages.length))] : [];
    });
    if (claim.outcome !== 'completed' || !claim.pipeline || !claim.prompt) return claim.outcome;
    const def = claim.pipeline;
    const pinned = claim.prompt;

    // 2. Each incomplete stage, then its checkpoint.
    for (const [index, stage] of def.stages.entries()) {
      const row = await db.withUser({ userId: message.userId, role: 'user' }, (tx) => tx.selectFrom('generations').selectAll().where('id', '=', message.generationId).executeTakeFirst());
      if (!row || row.status === 'ready' || row.status === 'failed') return 'skipped';
      const checkpoint = readCheckpoint(row);
      if (checkpoint.completed.includes(stage.name)) continue;

      let result;
      try {
        result = await stage.run({
          generationId: row.id,
          userId: row.user_id,
          kind: row.kind as GenerationKind,
          input: { title: (row.input as { title?: string } | null)?.title },
          run: (row.input ?? {}) as Record<string, unknown>,
          outputs: checkpoint.outputs,
          prompt: pinned,
          prompts,
          db,
          correlationId: message.correlationId,
          gateway: deps.gateway,
          ...(deps.latex ? { latex: deps.latex } : {}),
        });
      } catch (error) {
        return handleStageError(message, def, stage.name, error);
      }

      const next = def.stages[index + 1];
      let stop: RunOutcome | null = null;
      await boundary(message, `after:${stage.name}`, async (tx) => {
        const current = await lockGeneration(tx, message.generationId);
        if (!current || current.status === 'ready' || current.status === 'failed') {
          stop = 'skipped';
          return [];
        }
        if (current.cancel_requested_at) {
          stop = 'failed';
          const event = await failGeneration(tx, current, 'cancelled', FAILURE_MESSAGE.cancelled, def.stages.length);
          return event ? [event] : [];
        }
        const saved = readCheckpoint(current);
        if (saved.completed.includes(stage.name)) return []; // a concurrent duplicate got here first
        const updated = await tx
          .updateTable('generations')
          .set({
            checkpoint: JSON.stringify({ completed: [...saved.completed, stage.name], outputs: { ...saved.outputs, [stage.name]: result.output } }),
            stage_log: sql`stage_log || ${JSON.stringify([{ stage: stage.name, attempt: current.attempt, at: new Date().toISOString(), ...(result.meta ? { provider: result.meta.provider, model: result.meta.model, failedOver: result.meta.failedOver, truncated: result.meta.truncated, costMicros: result.meta.costMicros } : {}) }])}::jsonb`,
            ...(next ? { current_stage: next.name, status: next.status } : {}),
          })
          .where('id', '=', current.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        const snapshot = toSnapshot(updated, def.stages.length);
        const events = [await appendEvent(tx, current.id, current.user_id, 'stage_completed', stage.name, snapshot)];
        if (next) events.push(await appendEvent(tx, current.id, current.user_id, 'stage_started', next.name, snapshot));
        return events;
      });
      if (stop) return stop;
    }

    // 3. The terminal success transaction: ready, the quota charge (once) and the activity entry.
    await boundary(message, 'complete', async (tx) => {
      const row = await lockGeneration(tx, message.generationId);
      if (!row || row.status === 'ready' || row.status === 'failed') return [];
      const kind = row.kind as RunKind;
      const metric = QUOTA_METRIC[kind];
      // P12-09: the reservation taken at start becomes the charge. A run started before reservations
      // existed (0031) is charged the old way, once.
      const committed = await commitRun(tx, row);
      const charge = !committed && row.quota_charged_at === null && row.quota_reservation === null && metric !== null;
      if (charge) {
        await tx
          .insertInto('usage_counters')
          .values({
            user_id: row.user_id,
            metric: metric!,
            period_start: sql`date_trunc('month', now() at time zone 'utc')::date`,
            period_end: sql`(date_trunc('month', now() at time zone 'utc') + interval '1 month')::date`,
            used: 1,
          })
          .onConflict((oc) => oc.columns(['user_id', 'metric', 'period_start']).doUpdateSet({ used: sql`usage_counters.used + 1`, updated_at: sql`now()` }))
          .execute();
      }
      const updated = await tx
        .updateTable('generations')
        .set({ status: 'ready', finished_at: sql`now()`, current_stage: null, ...(charge || committed ? { quota_charged_at: sql`now()` } : {}) })
        .where('id', '=', row.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const activity = ACTIVITY_KIND[kind];
      if (activity && kind !== 'section') {
        await tx
          .insertInto('activity')
          .values({ user_id: row.user_id, kind: activity, title: `**${GENERATION_KIND_LABEL[kind]}** ready`, deep_link: `/generations/${row.id}`, resume_id: row.resume_id })
          .execute();
      }
      await askAfterRun(tx, updated);
      await notifyRunReady(tx, updated);
      return [await appendEvent(tx, row.id, row.user_id, 'completed', null, toSnapshot(updated, def.stages.length))];
    });
    return 'completed';
  }

  async function handleStageError(message: RunMessage, def: PipelineDef, stage: string, error: unknown): Promise<RunOutcome> {
    const transient = error instanceof LlmError ? error.retryable : !(error instanceof StageError || error instanceof ContactDataError);
    const lastChance = message.receiveCount >= MAX_RECEIVES;
    log.warn({ event: 'pipeline.stage_failed', generationId: message.generationId, stage, transient, receiveCount: message.receiveCount, errorName: error instanceof Error ? error.name : typeof error, failure: error instanceof LlmError ? error.failure : undefined }, 'stage failed');
    if (transient && !lastChance) throw error; // the worker redelivers with backoff
    const [code, text] = transient
      ? (['dead_lettered', FAILURE_MESSAGE.dead_lettered] as const)
      : error instanceof LlmError
        ? (['provider', FAILURE_MESSAGE.provider] as const)
        : (['invalid', FAILURE_MESSAGE.invalid] as const);
    await boundary(message, `fail:${stage}`, async (tx) => {
      const row = await lockGeneration(tx, message.generationId);
      if (!row) return [];
      const event = await failGeneration(tx, row, error instanceof StageError ? error.code : code, text, def.stages.length);
      return event ? [event] : [];
    });
    // On the last allowed receive the message is not acknowledged, so it dead-letters for inspection.
    if (transient) throw error;
    return 'failed';
  }

  return { run };
}
