import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import type { Tx } from '../db/database';
import type { LatexDensity } from '../export/latex/types';
import { errors } from '../http/errors';
import { loadFacts } from '../pipeline/facts';
import { contentHashOf, scoreAgainst, scoringJdOfStage, writeReport } from '../pipeline/stages/persist';
import { readJdRow, stageJdOf } from '../pipeline/stages/resume';
import { ledgerOf, timelineOf } from '../pipeline/stages/validate';
import { queueRender } from './renders';

/**
 * Every hand-made change to a document is a new immutable version (ImBackendImplementationPlan
 * P10-01/02; V2 §7.11): an edit, a fix, a restore, a Zero Resume answer. A resume version carries
 * its claim ledger and timeline report like a generated one, and is re-scored under the current
 * method when the document was scored before (Q-01: stamped, never carried across).
 */

export type VersionActor = 'user' | 'restore' | 'zero_review' | 'generation' | 'upload';

/** The resume row, locked for the length of the write so two saves cannot take the same number. */
export async function lockResume(tx: Tx, id: string) {
  const row = await tx
    .selectFrom('resumes')
    .select(['id', 'doc_type', 'source', 'job_description_id', 'current_version_id', 'row_version'])
    .where('id', '=', id)
    .where('trashed_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();
  if (!row) throw errors.notFound('resume');
  return row;
}

export async function insertVersion(
  tx: Tx,
  args: { userId: string; resumeId: string; content: object; note: string; createdBy: VersionActor; ledger?: unknown; timeline?: unknown; generationId?: string; density?: LatexDensity; inheritAccuracy?: boolean },
): Promise<string> {
  // A version that only drops or rewords the confirmed one's own lines ("Fit to one page", an AI
  // rewrite from the resume's own lines) keeps its accuracy confirmation (toreview §114).
  const previous = args.inheritAccuracy
    ? await tx.selectFrom('resumes as r').innerJoin('resume_versions as v', 'v.id', 'r.current_version_id').select('v.accuracy_confirmed_at').where('r.id', '=', args.resumeId).executeTakeFirst()
    : undefined;
  const last = await tx.selectFrom('resume_versions').select((eb) => eb.fn.max('version_number').as('max')).where('resume_id', '=', args.resumeId).executeTakeFirst();
  const version = await tx
    .insertInto('resume_versions')
    .values({
      resume_id: args.resumeId,
      user_id: args.userId,
      generation_id: args.generationId ?? null,
      version_number: Number(last?.max ?? 0) + 1,
      content: JSON.stringify(args.content),
      content_hash: contentHashOf(args.content),
      claim_ledger: args.ledger === undefined ? null : JSON.stringify(args.ledger),
      timeline_validation_result: args.timeline === undefined ? null : JSON.stringify(args.timeline),
      created_by: args.createdBy,
      change_note: args.note.slice(0, 300),
      ...(previous?.accuracy_confirmed_at ? { accuracy_confirmed_at: previous.accuracy_confirmed_at } : {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const resume = await tx.updateTable('resumes').set({ current_version_id: version.id }).where('id', '=', args.resumeId).returning('doc_type').executeTakeFirstOrThrow();
  // Every resume version is typeset on the worker (toreview §111); a cover letter is not.
  if (resume.doc_type === 'resume') await queueRender(tx, { userId: args.userId, resumeId: args.resumeId, versionId: version.id, ...(args.density !== undefined ? { density: args.density } : {}) });
  return version.id;
}

/**
 * Writes a resume version with its checks, and its score when the document was scored before (or
 * when `score` says so: a duplicate of a scored resume).
 * Returns the new version id.
 */
export async function writeResumeVersion(
  tx: Tx,
  args: { userId: string; resumeId: string; jdId: string | null; doc: CanonicalResumeJson; note: string; createdBy: VersionActor; score?: boolean; generationId?: string; density?: LatexDensity; inheritAccuracy?: boolean },
): Promise<string> {
  const now = new Date();
  const asOf = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const { facts, contact } = await loadFacts(tx, args.userId);
  const ledger = ledgerOf(args.doc, facts, asOf);
  const timeline = timelineOf(args.doc, facts, asOf);
  const versionId = await insertVersion(tx, { userId: args.userId, resumeId: args.resumeId, content: args.doc, note: args.note, createdBy: args.createdBy, ledger, timeline, ...(args.generationId ? { generationId: args.generationId } : {}), ...(args.density !== undefined ? { density: args.density } : {}), ...(args.inheritAccuracy ? { inheritAccuracy: true } : {}) });

  const score =
    args.score ??
    !!(await tx
      .selectFrom('ats_reports as a')
      .innerJoin('resume_versions as v', 'v.id', 'a.resume_version_id')
      .select('a.id')
      .where('v.resume_id', '=', args.resumeId)
      .executeTakeFirst());
  if (!score) return versionId;

  const jdRow = args.jdId ? await readJdRow(tx, args.jdId) : undefined;
  const jd = jdRow && jdRow.status === 'ready' ? stageJdOf(jdRow) : null;
  const result = scoreAgainst({ document: args.doc, facts, contact, jd: jd ? scoringJdOfStage(jd) : null, asOf });
  await writeReport(tx, { userId: args.userId, versionId, generationId: null, result, hasJd: jd !== null });
  return versionId;
}
