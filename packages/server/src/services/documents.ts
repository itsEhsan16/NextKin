import type { AtsScore, Resume } from '@nextkin/shared/models/resume';
import type { DocumentContent } from '@nextkin/shared/models/resumeContent';

import type { Database, Identity } from '../db/database';
import { AppError, errors } from '../http/errors';
import { readContent, resumeCard } from './resumeRead';

/**
 * A finished generation's document, as the apps model it (ImBackendImplementationPlan P9-08). Since
 * P10 it is read through the library (`resumeRead.ts`), so a run's result and the library's copy of
 * the same document can never disagree: the card, the body and the score panel of its version.
 */

export interface GenerationResult {
  resume: Resume;
  content: DocumentContent;
  score?: AtsScore;
}

export async function generationResult(db: Database, identity: Identity, generationId: string): Promise<GenerationResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(generationId)) throw errors.notFound('generation');
  return db.withUser(identity, async (tx) => {
    const gen = await tx.selectFrom('generations').select(['status', 'kind', 'resume_id', 'source_resume_id']).where('id', '=', generationId).where('kind', '<>', 'section').executeTakeFirst();
    if (!gen) throw errors.notFound('generation');
    if (gen.status !== 'ready') throw new AppError('CONFLICT', 'This run has not finished.');
    // An interview run leaves a practice set, not a document (P11-08): /interview/question-sets/by-generation.
    if (gen.kind === 'interview') throw new AppError('CONFLICT', 'This run wrote a practice set, not a document.');
    const resumeId = gen.resume_id ?? gen.source_resume_id;
    if (!resumeId) throw errors.notFound('document');
    const resume = await resumeCard(tx, resumeId);
    const content = await readContent(tx, identity.userId, resumeId);
    const report = await tx.selectFrom('ats_reports').select('basis').where('resume_version_id', '=', resume.currentVersionId).orderBy('created_at', 'desc').executeTakeFirst();
    const score = ((report?.basis as { panel?: AtsScore | null } | null)?.panel ?? undefined) as AtsScore | undefined;
    return { resume, content, ...(score ? { score } : {}) };
  });
}
