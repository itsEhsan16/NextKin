import { sql } from 'kysely';

import type { AiGateway } from '../../ai/gateway';
import type { Database } from '../../db/database';
import { AppError, errors } from '../../http/errors';
import type { Logger } from '../../observability/logger';
import { enqueue } from '../../outbox/outbox';
import { createPromptAdmin, type PromptBody } from '../prompts';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * Prompt management (ImBackendImplementationPlan P12-03; spec §7.17, G16). A version moves
 * draft → staged → active, and **no staged version becomes active without a passing evaluation of
 * that exact version**. Rollback re-activates an earlier version, which passed when it went live.
 *
 * An evaluation runs on the worker, billed and logged apart from product traffic (tag `eval`):
 * - jd.extract, resume.generate, resume.revise: the golden set and its gate (P9-06: zero
 *   anachronisms, the ledger metrics, the adversarial bar);
 * - assistant.classify: the scope set at 95% (P11-09);
 * - any other template has no eval yet, so it cannot be published (`unsupported`).
 * With no live model configured (fake or recorded route) the scripted reference model answers,
 * and the evaluation says so (`mode: reference`).
 */

export const EVALUATED_TEMPLATES = ['jd.extract', 'resume.generate', 'resume.revise', 'assistant.classify'] as const;

const staffDb = (db: Database, staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;

export async function listPrompts(db: Database, staff: Staff) {
  const rows = await db.withUser(staffDb(db, staff), (tx) =>
    tx
      .selectFrom('prompt_templates as t')
      .innerJoin('prompt_template_versions as v', 'v.prompt_template_id', 't.id')
      .select(['t.name', 't.stage', 't.description', 'v.id', 'v.version', 'v.status', 'v.eval_run_ref', 'v.created_at', 'v.body'])
      .orderBy('t.name')
      .orderBy('v.version', 'desc')
      .execute(),
  );
  const byName = new Map<string, { name: string; stage: string; description: string | null; evaluated: boolean; versions: unknown[] }>();
  for (const r of rows) {
    const entry = byName.get(r.name) ?? { name: r.name, stage: r.stage, description: r.description, evaluated: (EVALUATED_TEMPLATES as readonly string[]).includes(r.name), versions: [] };
    entry.versions.push({ id: r.id, version: r.version, status: r.status, evaluated: r.eval_run_ref !== null, createdAt: new Date(r.created_at).toISOString(), body: r.body });
    byName.set(r.name, entry);
  }
  return [...byName.values()];
}

export async function draftPrompt(db: Database, staff: Staff, name: string, body: PromptBody, meta: RequestMeta) {
  const version = await createPromptAdmin(db, staffDb(db, staff)).draft(name, body).catch((e: unknown) => {
    throw e instanceof Error && /no result/i.test(e.message) ? errors.notFound('prompt template') : e;
  });
  await db.withUser(staffDb(db, staff), (tx) => writeAudit(tx, staff, { action: 'prompt.draft', targetType: 'prompt', targetId: version.id, after: { name, version: version.version } }, meta));
  return version;
}

export async function stagePrompt(db: Database, staff: Staff, versionId: string, meta: RequestMeta) {
  await createPromptAdmin(db, staffDb(db, staff)).stage(versionId).catch(() => {
    throw errors.conflict('Only a draft can be staged.');
  });
  await db.withUser(staffDb(db, staff), (tx) => writeAudit(tx, staff, { action: 'prompt.stage', targetType: 'prompt', targetId: versionId }, meta));
}

/** Asks the worker to evaluate a version. Returns the evaluation to poll. */
export async function evaluatePrompt(db: Database, staff: Staff, versionId: string, meta: RequestMeta) {
  return db.withUser(staffDb(db, staff), async (tx) => {
    const version = await tx.selectFrom('prompt_template_versions as v').innerJoin('prompt_templates as t', 't.id', 'v.prompt_template_id').select(['v.id', 't.name']).where('v.id', '=', versionId).executeTakeFirst();
    if (!version) throw errors.notFound('prompt version');
    const row = await tx.insertInto('prompt_evaluations').values({ prompt_version_id: versionId, requested_by: staff.identity.userId }).returning(['id', 'status', 'created_at']).executeTakeFirstOrThrow();
    await enqueue(tx, { queue: 'maintenance', groupId: `prompt-eval:${version.name}`, type: 'prompt.evaluate', payload: { evaluationId: row.id }, correlationId: meta.requestId ?? null });
    await writeAudit(tx, staff, { action: 'prompt.evaluate', targetType: 'prompt', targetId: versionId, after: { evaluationId: row.id } }, meta);
    return { id: row.id, status: row.status, createdAt: new Date(row.created_at).toISOString() };
  });
}

export async function getEvaluation(db: Database, staff: Staff, evaluationId: string) {
  const row = await db.withUser(staffDb(db, staff), (tx) => tx.selectFrom('prompt_evaluations').selectAll().where('id', '=', evaluationId).executeTakeFirst());
  if (!row) throw errors.notFound('evaluation');
  return { id: row.id, versionId: row.prompt_version_id, status: row.status, mode: row.mode, report: row.report, createdAt: new Date(row.created_at).toISOString(), finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null };
}

/** Publishes a staged version (only with a passing evaluation) or rolls back to an archived one. */
export async function activatePrompt(db: Database, staff: Staff, versionId: string, meta: RequestMeta) {
  const before = await db.withUser(staffDb(db, staff), (tx) => tx.selectFrom('prompt_template_versions').select(['status', 'eval_run_ref']).where('id', '=', versionId).executeTakeFirst());
  if (!before) throw errors.notFound('prompt version');
  if (before.status === 'staged' && !before.eval_run_ref) throw new AppError('CONFLICT', 'This version has no passing evaluation. Evaluate it first.', { reason: 'eval_required' });
  await createPromptAdmin(db, staffDb(db, staff)).activate(versionId).catch(() => {
    throw errors.conflict('Only a staged or earlier version can be made active.');
  });
  await db.withUser(staffDb(db, staff), (tx) => writeAudit(tx, staff, { action: before.status === 'archived' ? 'prompt.rollback' : 'prompt.publish', targetType: 'prompt', targetId: versionId, before: { status: before.status }, after: { status: 'active', evalRunRef: before.eval_run_ref } }, meta));
}

export interface EvalDeps {
  db: Database;
  log: Logger;
  /** The gateway to evaluate with, or null when no live model is configured (the reference model answers). */
  gateway: AiGateway | null;
  /** Runs the eval for a template with a candidate system prompt; injected so the harness stays out of the API bundle. */
  run: (template: string, system: string[], gateway: AiGateway | null) => Promise<{ pass: boolean; mode: 'reference' | 'recorded' | 'live'; report: unknown }>;
}

/** The worker side: runs the evaluation and, on a pass, marks the version publishable. Idempotent. */
export async function runPromptEvaluation(deps: EvalDeps, evaluationId: string): Promise<string> {
  const row = await deps.db.withSystem('prompts: read an evaluation', (tx) =>
    tx
      .selectFrom('prompt_evaluations as e')
      .innerJoin('prompt_template_versions as v', 'v.id', 'e.prompt_version_id')
      .innerJoin('prompt_templates as t', 't.id', 'v.prompt_template_id')
      .select(['e.id', 'e.status', 'v.id as version_id', 'v.body', 't.name'])
      .where('e.id', '=', evaluationId)
      .executeTakeFirst(),
  );
  if (!row || row.status !== 'running') return 'skipped';
  const finish = (status: 'passed' | 'failed' | 'unsupported', mode: string | null, report: unknown) =>
    deps.db.withSystem('prompts: record an evaluation', async (tx) => {
      await tx.updateTable('prompt_evaluations').set({ status, mode: mode as never, report: JSON.stringify(report ?? null), finished_at: sql`now()` }).where('id', '=', evaluationId).execute();
      if (status === 'passed') await tx.updateTable('prompt_template_versions').set({ eval_run_ref: evaluationId }).where('id', '=', row.version_id).execute();
    });
  if (!(EVALUATED_TEMPLATES as readonly string[]).includes(row.name)) {
    await finish('unsupported', null, { message: `No evaluation covers ${row.name} yet, so it cannot be published.` });
    return 'unsupported';
  }
  try {
    const system = (row.body as { system: string[] }).system;
    const result = await deps.run(row.name, system, deps.gateway);
    await finish(result.pass ? 'passed' : 'failed', result.mode, result.report);
    return result.pass ? 'passed' : 'failed';
  } catch (error) {
    deps.log.warn({ event: 'prompts.eval_failed', errorName: error instanceof Error ? error.name : typeof error }, 'prompt evaluation failed');
    await finish('failed', null, { message: 'The evaluation could not run.' });
    return 'failed';
  }
}
