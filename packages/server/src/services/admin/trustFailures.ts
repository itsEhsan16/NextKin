import { sql } from 'kysely';

import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { nullPublisher } from '../../pipeline/events';
import { PIPELINES } from '../../pipeline/pipelines';
import { FAILURE_MESSAGE, MAX_RECEIVES } from '../../pipeline/runner';
import type { RunKind } from '../../pipeline/stages';
import { retryGeneration } from '../generations';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * The generation-failure queue (admin portal, Figma 406:1195; toreview §171.13). A run is in the
 * queue when it failed for a reason staff can act on (not a cancel, not missing AI consent), or when
 * staff acted on it. Its state is read, never stored twice:
 *
 * - open: failed, and no staff action since it last failed;
 * - retrying: staff retried it and it hasn't finished again;
 * - resolved: staff closed it, or a staff retry finished ready.
 *
 * Nothing here reads a run's input, output or checkpoint content: only its kind, status, codes,
 * stage names, counts and times (§7.17: no resume content in the admin portal).
 */

/** How far back the queue reaches, and the most rows it returns. */
const QUEUE_DAYS = 90;
export const QUEUE_LIMIT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Codes that are the user's own doing, not a failure staff can fix. */
const NOT_FAILURES = ['cancelled', 'consent_required'];

export type FailureKind = 'tailor' | 'resume_build' | 'cover_letter' | 'ats_check' | 'interview';
export type FailureStatus = 'open' | 'retrying' | 'resolved';

export interface FailureRow {
  id: string;
  kind: FailureKind;
  stage: string;
  errorCode: string;
  userRef: string;
  attempts: number;
  maxAttempts: number;
  failedAt: string;
  status: FailureStatus;
}

const iso = (value: Date | string) => new Date(value).toISOString();

/** The portal's five kinds: a resume run with a tailoring is a tailor; any other resume run a build. */
export function failureKind(kind: string, tailored: boolean): FailureKind {
  if (kind === 'cover_letter' || kind === 'ats_check' || kind === 'interview') return kind;
  return tailored ? 'tailor' : 'resume_build';
}

/** A run's place in the queue from its own status and its latest staff action; null when it isn't in it. */
export function failureStatus(run: { status: string; finishedAt: Date | null }, action: { action: string; at: Date } | null): FailureStatus | null {
  const finished = run.finishedAt?.getTime() ?? null;
  if (action?.action === 'resolve') {
    // Closed, unless it failed again later (the user retried it themselves).
    return run.status === 'failed' && finished !== null && finished > action.at.getTime() ? 'open' : 'resolved';
  }
  if (action?.action === 'retry') {
    if (run.status === 'ready') return 'resolved';
    if (run.status === 'failed') return finished !== null && finished > action.at.getTime() ? 'open' : 'retrying';
    return 'retrying';
  }
  return run.status === 'failed' ? 'open' : null;
}

interface QueueRecord {
  id: string;
  kind: string;
  user_id: string;
  attempt: number;
  status: string;
  error_code: string | null;
  finished_at: Date | null;
  tailored: boolean;
  failed_stage: string | null;
  failed_at: Date | null;
  action: string | null;
  action_at: Date | null;
  action_code: string | null;
  action_stage: string | null;
}

function toRow(record: QueueRecord): FailureRow | null {
  const status = failureStatus({ status: record.status, finishedAt: record.finished_at ? new Date(record.finished_at) : null }, record.action && record.action_at ? { action: record.action, at: new Date(record.action_at) } : null);
  if (!status) return null;
  const failedAt = record.failed_at ?? record.finished_at ?? record.action_at;
  return {
    id: record.id,
    kind: failureKind(record.kind, record.tailored),
    stage: record.failed_stage ?? record.action_stage ?? 'unknown',
    // A retry clears the run's error; the action kept the code it was taken against.
    errorCode: record.error_code ?? record.action_code ?? 'unknown',
    userRef: record.user_id,
    attempts: record.attempt,
    maxAttempts: MAX_RECEIVES,
    failedAt: failedAt ? iso(failedAt) : iso(new Date(0)),
    status,
  };
}

/** The queue, newest failure first, capped at QUEUE_LIMIT. */
export async function listFailures(db: Database, staff: Staff): Promise<{ rows: FailureRow[]; capped: boolean }> {
  const records = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: the generation-failure queue', async (tx) => {
    const result = await sql<QueueRecord>`
      with last_action as (
        select distinct on (generation_id) generation_id, action, created_at, error_code, failed_stage
        from app.generation_failure_actions
        where created_at > now() - make_interval(days => ${QUEUE_DAYS})
        order by generation_id, created_at desc
      ), last_fail as (
        select distinct on (generation_id) generation_id, stage, created_at
        from app.generation_events
        where event = 'failed' and created_at > now() - make_interval(days => ${QUEUE_DAYS})
        order by generation_id, id desc
      )
      select g.id, g.kind, g.user_id, g.attempt, g.status, g.error_code, g.finished_at,
             (g.input ? 'tailor') as tailored,
             lf.stage as failed_stage, lf.created_at as failed_at,
             la.action, la.created_at as action_at, la.error_code as action_code, la.failed_stage as action_stage
      from app.generations g
      left join last_action la on la.generation_id = g.id
      left join last_fail lf on lf.generation_id = g.id
      where (g.status = 'failed' and coalesce(g.error_code, '') <> all(${sql.val(NOT_FAILURES)}::text[])
             and g.finished_at > now() - make_interval(days => ${QUEUE_DAYS}))
         or la.generation_id is not null
      order by coalesce(lf.created_at, g.finished_at, la.created_at) desc
      limit ${QUEUE_LIMIT + 1}`.execute(tx);
    return result.rows;
  });
  const capped = records.length > QUEUE_LIMIT;
  const rows = records.slice(0, QUEUE_LIMIT).map(toRow).filter((row): row is FailureRow => row !== null);
  return { rows, capped };
}

export interface FailureStatsWire {
  /** Runs that failed in the last thirty days (a cancel or a consent stop isn't a failure). */
  failed30d: number;
  /** Every run started in the last thirty days. */
  totalRuns30d: number;
  open: number;
  oldestOpenAt: string | null;
  /** Every open run used all its automatic attempts. */
  openRetriesUsedUp: boolean;
  /** Distinct runs staff retried in the last thirty days, and how many of them finished ready. */
  retried30d: number;
  retriedOk30d: number;
  /** The commonest code and stage among the queue's failures in the last thirty days. */
  mostCommon: { errorCode: string; stage: string; runs: number } | null;
  /** The queue behind `open` hit its cap, so `open` may be low. */
  capped: boolean;
}

export async function failureStats(db: Database, staff: Staff): Promise<FailureStatsWire> {
  const { rows, capped } = await listFailures(db, staff);
  const counts = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: generation-failure figures', async (tx) => {
    const failed = await sql<{ n: number }>`
      select count(distinct generation_id)::int as n from app.generation_events
      where event = 'failed' and created_at > now() - interval '30 days'
        and coalesce(snapshot->>'cancelled', 'false') <> 'true'
        and coalesce(snapshot->>'error', '') <> ${FAILURE_MESSAGE.consent}`.execute(tx);
    const total = await sql<{ n: number }>`select count(*)::int as n from app.generations where created_at > now() - interval '30 days'`.execute(tx);
    const retried = await sql<{ n: number; ok: number }>`
      select count(*)::int as n, count(*) filter (where g.status = 'ready')::int as ok
      from (select distinct generation_id from app.generation_failure_actions where action = 'retry' and created_at > now() - interval '30 days') a
      join app.generations g on g.id = a.generation_id`.execute(tx);
    return { failed: failed.rows[0]?.n ?? 0, total: total.rows[0]?.n ?? 0, retried: retried.rows[0]?.n ?? 0, ok: retried.rows[0]?.ok ?? 0 };
  });

  const open = rows.filter((row) => row.status === 'open');
  const since = Date.now() - 30 * 86_400_000;
  const causes = new Map<string, { errorCode: string; stage: string; runs: number }>();
  for (const row of rows) {
    if (new Date(row.failedAt).getTime() < since) continue;
    const key = `${row.errorCode}\u0000${row.stage}`;
    const cause = causes.get(key) ?? { errorCode: row.errorCode, stage: row.stage, runs: 0 };
    cause.runs += 1;
    causes.set(key, cause);
  }
  const mostCommon = [...causes.values()].sort((a, b) => b.runs - a.runs)[0] ?? null;
  const oldest = open.reduce<string | null>((min, row) => (min === null || row.failedAt < min ? row.failedAt : min), null);

  return {
    failed30d: counts.failed,
    totalRuns30d: counts.total,
    open: open.length,
    oldestOpenAt: oldest,
    openRetriesUsedUp: open.length > 0 && open.every((row) => row.attempts >= row.maxAttempts),
    retried30d: counts.retried,
    retriedOk30d: counts.ok,
    mostCommon,
    capped,
  };
}

export interface FailureDetailWire extends FailureRow {
  stages: { name: string; outcome: 'done' | 'failed' | 'skipped'; detail: string; seconds?: number }[];
  error: { message: string; requestRef: string | null; retryPolicy: string };
  prompt: { name: string; version: number; publishedAt: string | null } | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: string;
  endedAt: string | null;
}

export const RETRY_POLICY = `up to ${MAX_RECEIVES} deliveries with backoff, then dead-lettered`;

/** One run for the drawer: its stages, error, prompt version, model and token counts. No content. */
export async function failureDetail(db: Database, staff: Staff, id: string): Promise<FailureDetailWire> {
  if (!UUID.test(id)) throw errors.notFound('run');
  const { rows } = await listFailures(db, staff);
  const row = rows.find((r) => r.id === id);
  if (!row) throw errors.notFound('run');
  return db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: a failed run’s details', async (tx) => {
    const run = await tx
      .selectFrom('generations')
      .select(['kind', 'error_message', 'started_at', 'created_at', 'finished_at', 'prompt_template_version_id', sql<string[]>`coalesce(checkpoint->'completed', '[]'::jsonb)`.as('completed'), sql<{ stage: string; model?: string }[]>`(select coalesce(jsonb_agg(jsonb_build_object('stage', e->>'stage', 'model', e->>'model')), '[]'::jsonb) from jsonb_array_elements(stage_log) e)`.as('log')])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const events = await tx.selectFrom('generation_events').select(['event', 'stage', 'created_at']).where('generation_id', '=', id).orderBy('id', 'asc').execute();
    const calls = await tx
      .selectFrom('ai_calls')
      .select(['id', 'model', 'correlation_id', 'input_tokens', 'output_tokens', 'created_at'])
      .where('generation_id', '=', id)
      .orderBy('created_at', 'asc')
      .execute();
    const prompt = run.prompt_template_version_id
      ? await tx
          .selectFrom('prompt_template_versions as v')
          .innerJoin('prompt_templates as t', 't.id', 'v.prompt_template_id')
          .select(['t.name', 'v.version', 'v.id'])
          .where('v.id', '=', run.prompt_template_version_id)
          .executeTakeFirst()
      : undefined;
    // A version carries no publish time; its latest publish (or rollback to it) in the audit log does.
    const published = prompt
      ? await tx.selectFrom('audit_logs').select('created_at').where('target_type', '=', 'prompt').where('target_id', '=', prompt.id).where('action', 'in', ['prompt.publish', 'prompt.rollback']).orderBy('created_at', 'desc').executeTakeFirst()
      : undefined;

    const completed = new Set(run.completed);
    const names = PIPELINES[run.kind as RunKind]?.stages.map((stage) => stage.name) ?? [...completed];
    const stages = names.map((name) => {
      // The stage's last completion and the start before it: how long its finished attempt took.
      const doneAt = [...events].reverse().find((e) => e.event === 'stage_completed' && e.stage === name);
      const startAt = doneAt ? [...events].filter((e) => e.event === 'stage_started' && e.stage === name && e.created_at <= doneAt.created_at).pop() : undefined;
      const model = [...run.log].reverse().find((entry) => entry.stage === name)?.model ?? null;
      if (completed.has(name)) {
        return {
          name,
          outcome: 'done' as const,
          detail: model ?? '',
          ...(doneAt && startAt ? { seconds: Math.max(0, Math.round((new Date(doneAt.created_at).getTime() - new Date(startAt.created_at).getTime()) / 100) / 10) } : {}),
        };
      }
      if (name === row.stage) return { name, outcome: 'failed' as const, detail: run.error_message ?? '' };
      return { name, outcome: 'skipped' as const, detail: 'Not reached' };
    });

    const last = calls.at(-1);
    return {
      ...row,
      stages,
      error: { message: run.error_message ?? '', requestRef: last ? (last.correlation_id ?? last.id) : null, retryPolicy: RETRY_POLICY },
      prompt: prompt ? { name: prompt.name, version: prompt.version, publishedAt: published ? iso(published.created_at) : null } : null,
      model: last?.model ?? null,
      tokensIn: calls.reduce((sum, call) => sum + call.input_tokens, 0),
      tokensOut: calls.reduce((sum, call) => sum + call.output_tokens, 0),
      startedAt: iso(run.started_at ?? run.created_at),
      endedAt: run.finished_at ? iso(run.finished_at) : null,
    };
  });
}

async function openRun(db: Database, staff: Staff, id: string) {
  if (!UUID.test(id)) throw errors.notFound('run');
  const { rows } = await listFailures(db, staff);
  const row = rows.find((r) => r.id === id);
  if (!row) throw errors.notFound('run');
  return row;
}

export interface RetryOutcome {
  retried: string[];
  skipped: { id: string; reason: string }[];
}

/**
 * A staff retry is the user's own retry (`retryGeneration`: from the first incomplete stage, with
 * its quota slots reserved again), then recorded and audited. Only an open run is retried.
 */
export async function retryFailures(db: Database, staff: Staff, ids: string[], meta: RequestMeta): Promise<RetryOutcome> {
  const outcome: RetryOutcome = { retried: [], skipped: [] };
  for (const id of [...new Set(ids)]) {
    const row = await openRun(db, staff, id).catch(() => null);
    if (!row) {
      outcome.skipped.push({ id, reason: 'not_found' });
      continue;
    }
    if (row.status !== 'open') {
      outcome.skipped.push({ id, reason: row.status });
      continue;
    }
    try {
      await retryGeneration(db, { userId: row.userRef, role: 'user' }, nullPublisher, id, meta.requestId ?? null);
    } catch (error) {
      const code = (error as { code?: string }).code;
      outcome.skipped.push({ id, reason: code === 'PLAN_LOCKED' ? 'quota' : code === 'CONFLICT' ? 'not_failed' : 'error' });
      continue;
    }
    await db.withSystem(`admin ${staff.identity.userId}: retry a failed run`, async (tx) => {
      await tx.insertInto('generation_failure_actions').values({ generation_id: id, subject_user_id: row.userRef, action: 'retry', error_code: row.errorCode, failed_stage: row.stage, staff_user_id: staff.identity.userId }).execute();
      await writeAudit(tx, staff, { action: 'generation.retry', targetType: 'generation', targetId: id, before: { status: 'failed', errorCode: row.errorCode, stage: row.stage }, after: { status: 'queued' }, reason: 'Manual retry' }, meta);
    });
    outcome.retried.push(id);
  }
  return outcome;
}

/** Closes a run without retrying it. A run already resolved stays as it was. */
export async function resolveFailure(db: Database, staff: Staff, id: string, meta: RequestMeta): Promise<{ status: FailureStatus }> {
  const row = await openRun(db, staff, id);
  if (row.status === 'resolved') return { status: 'resolved' };
  await db.withSystem(`admin ${staff.identity.userId}: close a failed run`, async (tx) => {
    await tx.insertInto('generation_failure_actions').values({ generation_id: id, subject_user_id: row.userRef, action: 'resolve', error_code: row.errorCode, failed_stage: row.stage, staff_user_id: staff.identity.userId }).execute();
    await writeAudit(tx, staff, { action: 'generation.resolve', targetType: 'generation', targetId: id, before: { status: row.status }, after: { status: 'resolved' } }, meta);
  });
  return { status: 'resolved' };
}
