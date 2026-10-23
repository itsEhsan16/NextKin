import type { ResumeSectionKey } from '@nextkin/shared/models/resumeContent';
import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';

import { redactContact } from '../ai/pii';

import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';
import { loadFacts } from '../pipeline/facts';
import { announce } from './generations';
import { requireAiConsent } from './consent';

/**
 * `regenerateSection` over HTTP (ImBackendImplementationPlan P10-02): an async job the repository
 * awaits. Starting one files a `section` run against the resume; the repository polls its status
 * and reads the content once it is ready. Retrying with the same Idempotency-Key starts one run.
 *
 * With an `instruction` ("AI rewrite", toreview §113) the run's facts are the resume's own lines,
 * not the profile's: a follow-up edit rewords what the resume says and never adds to it (G13).
 */

export interface SectionRunStatus {
  id: string;
  status: 'running' | 'ready' | 'failed';
  message?: string;
}

const statusOf = (row: { id: string; status: string; error_message: string | null }): SectionRunStatus =>
  row.status === 'ready'
    ? { id: row.id, status: 'ready' }
    : row.status === 'failed'
      ? { id: row.id, status: 'failed', message: row.error_message ?? 'We could not regenerate that section.' }
      : { id: row.id, status: 'running' };

export async function startSectionRun(
  db: Database,
  identity: Identity,
  resumeId: string,
  section: ResumeSectionKey,
  options: { idempotencyKey: string; correlationId: string | null; instruction?: string },
): Promise<SectionRunStatus> {
  return db.withUser(identity, async (tx) => {
    const existing = await tx.selectFrom('generations').select(['id', 'status', 'error_message']).where('idempotency_key', '=', options.idempotencyKey).executeTakeFirst();
    if (existing) return statusOf(existing);
    await requireAiConsent(tx, identity.userId); // P12-12
    const resume = await tx.selectFrom('resumes').select(['id', 'doc_type', 'job_description_id', 'current_version_id']).where('id', '=', resumeId).where('trashed_at', 'is', null).executeTakeFirst();
    if (!resume || resume.doc_type !== 'resume' || !resume.current_version_id) throw errors.notFound('resume section');
    const profile = await loadFacts(tx, identity.userId);
    const instruction = options.instruction?.trim().slice(0, 300) || undefined;
    const current = instruction ? await tx.selectFrom('resume_versions').select('content').where('id', '=', resume.current_version_id).executeTakeFirst() : undefined;
    const doc = current ? canonicalResumeSchema.safeParse(current.content) : undefined;
    if (instruction && !doc?.success) throw errors.notFound('resume section');
    const snapshot = doc?.success ? { ...profile, facts: factsOfDocument(doc.data, { redact: redactContact }) } : profile;
    const now = new Date();
    const asOf = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const row = await tx
      .insertInto('generations')
      .values({
        user_id: identity.userId,
        kind: 'section',
        input: JSON.stringify({ kind: 'section', section, sourceResumeId: resumeId, ...(resume.job_description_id ? { jdId: resume.job_description_id } : {}), ...(instruction ? { instruction } : {}), snapshot, asOf }),
        idempotency_key: options.idempotencyKey,
        resume_id: resumeId,
        source_resume_id: resumeId,
        ...(resume.job_description_id ? { job_description_id: resume.job_description_id } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await announce(tx, row, options.correlationId);
    return statusOf(row);
  });
}

export async function sectionRunStatus(db: Database, identity: Identity, resumeId: string, runId: string): Promise<SectionRunStatus> {
  const row = await db.withUser(identity, (tx) =>
    tx.selectFrom('generations').select(['id', 'status', 'error_message']).where('id', '=', runId).where('kind', '=', 'section').where('resume_id', '=', resumeId).executeTakeFirst(),
  );
  if (!row) throw errors.notFound('regeneration');
  return statusOf(row);
}
