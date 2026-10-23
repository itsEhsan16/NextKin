import type { InterviewMark, InterviewQuestion, InterviewSet } from '@nextkin/shared/models/interview';
import { sql, type Selectable } from 'kysely';

import type { Database, Identity } from '../db/database';
import type { InterviewQuestionSets } from '../db/types.generated';
import { errors } from '../http/errors';

/**
 * Interview practice sets (ImBackendImplementationPlan P11-08; V2 §7.15). Sets are written by the
 * interview pipeline (`pipeline/stages/interview.ts`); here they are read back, marked, reset and
 * deleted. A mark is one atomic jsonb update, so two devices marking different questions of the
 * same set cannot overwrite each other.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Selectable<InterviewQuestionSets>;

export function toClientSet(row: Row): InterviewSet {
  return {
    id: row.id,
    title: row.title,
    source: row.is_generic ? 'standalone' : 'resume',
    ...(row.resume_id ? { resumeId: row.resume_id } : {}),
    ...(row.job_description_id ? { jdId: row.job_description_id } : {}),
    ...(row.job_id ? { jobId: row.job_id } : {}),
    ...(row.company ? { company: row.company } : {}),
    ...(row.role_title ? { roleTitle: row.role_title } : {}),
    ...(row.generation_id ? { generationId: row.generation_id } : {}),
    ...(row.regenerated_from_id ? { regeneratedFromId: row.regenerated_from_id } : {}),
    questions: row.questions as InterviewQuestion[],
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listSets(db: Database, identity: Identity): Promise<InterviewSet[]> {
  const rows = await db.withUser(identity, (tx) => tx.selectFrom('interview_question_sets').selectAll().orderBy('created_at', 'desc').limit(200).execute());
  return rows.map(toClientSet);
}

export async function getSet(db: Database, identity: Identity, id: string): Promise<InterviewSet> {
  if (!UUID.test(id)) throw errors.notFound('interview set');
  const row = await db.withUser(identity, (tx) => tx.selectFrom('interview_question_sets').selectAll().where('id', '=', id).executeTakeFirst());
  if (!row) throw errors.notFound('interview set');
  return toClientSet(row);
}

/** The set a run wrote; null while the run is in flight (or for a run that wrote none). */
export async function setByGeneration(db: Database, identity: Identity, generationId: string): Promise<InterviewSet | null> {
  if (!UUID.test(generationId)) return null;
  const row = await db.withUser(identity, (tx) => tx.selectFrom('interview_question_sets').selectAll().where('generation_id', '=', generationId).executeTakeFirst());
  return row ? toClientSet(row) : null;
}

export async function markQuestion(db: Database, identity: Identity, id: string, questionId: string, mark: InterviewMark): Promise<InterviewSet> {
  if (!UUID.test(id)) throw errors.notFound('interview set');
  return db.withUser(identity, async (tx) => {
    const row = await tx
      .updateTable('interview_question_sets')
      .set({
        questions: sql`(select jsonb_agg(case when q->>'id' = ${questionId} then jsonb_set(q, '{mark}', to_jsonb(${mark}::text)) else q end order by n) from jsonb_array_elements(questions) with ordinality as t(q, n))`,
      })
      .where('id', '=', id)
      .where(sql<boolean>`questions @> jsonb_build_array(jsonb_build_object('id', ${questionId}::text))`)
      .returningAll()
      .executeTakeFirst();
    if (row) return toClientSet(row);
    const exists = await tx.selectFrom('interview_question_sets').select('id').where('id', '=', id).executeTakeFirst();
    throw errors.notFound(exists ? 'question' : 'interview set');
  });
}

export async function resetMarks(db: Database, identity: Identity, id: string): Promise<InterviewSet> {
  if (!UUID.test(id)) throw errors.notFound('interview set');
  const row = await db.withUser(identity, (tx) =>
    tx
      .updateTable('interview_question_sets')
      .set({ questions: sql`(select coalesce(jsonb_agg(jsonb_set(q, '{mark}', '"unmarked"') order by n), '[]'::jsonb) from jsonb_array_elements(questions) with ordinality as t(q, n))` })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst(),
  );
  if (!row) throw errors.notFound('interview set');
  return toClientSet(row);
}

/** Deleting a set deletes only it; a set regenerated from it keeps its own questions. */
export async function removeSet(db: Database, identity: Identity, id: string): Promise<void> {
  if (!UUID.test(id)) throw errors.notFound('interview set');
  const gone = await db.withUser(identity, (tx) => tx.deleteFrom('interview_question_sets').where('id', '=', id).executeTakeFirst());
  if (Number(gone.numDeletedRows) === 0) throw errors.notFound('interview set');
}
