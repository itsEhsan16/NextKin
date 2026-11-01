import type { GapAnswer, GapQuestion } from '@nextkin/shared/models/profile';
import { gapChanges, gapQuestionsOf, gapRecord } from '@nextkin/shared/scoring/gapQuestions';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { entries, getProfile } from './profile';

/**
 * The gap interview (toreview §146.7). What it asks comes from the engine; what's been dealt with is
 * kept beside the job preferences, so a question isn't asked twice. An answer that states a fact goes
 * through the same writes as the profile's own forms, so it lands as the person's word.
 */

const answersOf = async (tx: Tx, userId: string): Promise<Record<string, string>> => {
  const row = await tx.selectFrom('profiles').select('preferences').where('user_id', '=', userId).executeTakeFirstOrThrow();
  return (row.preferences as { gapAnswers?: Record<string, string> } | null)?.gapAnswers ?? {};
};

export async function listGapQuestions(db: Database, identity: Identity): Promise<GapQuestion[]> {
  const { profile } = await getProfile(db, identity);
  const answered = await db.withUser(identity, (tx) => answersOf(tx, identity.userId));
  return gapQuestionsOf(profile, answered);
}

export async function answerGapQuestion(db: Database, identity: Identity, id: string, answer: GapAnswer): Promise<GapQuestion[]> {
  const { profile } = await getProfile(db, identity);
  const answered = await db.withUser(identity, (tx) => answersOf(tx, identity.userId));
  const question = gapQuestionsOf(profile, answered).find((q) => q.id === id);
  if (!question) throw errors.notFound('question');

  const { experience, education } = gapChanges(profile, question, answer);
  if (experience) await entries.replaceExperience(db, identity, experience.id, experience);
  if (education) await entries.replaceEducation(db, identity, education.id, education);

  await db.withUser(identity, (tx) =>
    tx
      .updateTable('profiles')
      .set({
        preferences: sql`preferences || jsonb_build_object('gapAnswers', coalesce(preferences->'gapAnswers', '{}'::jsonb) || jsonb_build_object(${id}::text, ${gapRecord(answer)}::text))`,
      })
      .where('user_id', '=', identity.userId)
      .execute(),
  );
  return listGapQuestions(db, identity);
}
