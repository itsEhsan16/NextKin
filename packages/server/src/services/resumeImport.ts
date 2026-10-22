import type { Resume } from '@nextkin/shared/models/resume';
import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';

import type { Database, Identity } from '../db/database';
import { AppError, errors } from '../http/errors';
import { resumeCard } from './resumeRead';
import { writeResumeVersion } from './versions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An uploaded resume into the library (toreview §110.4): the parse's document (`crossCheck.ts`:
 * only lines the file states, each the user's own) becomes a resume, `source 'uploaded'`, and the
 * base when the user has none. Making it twice returns the same resume (`resume_parses.resume_id`),
 * so a retried request never files a copy. Nothing is scored here: with no job there is no total
 * (D-15); the comparison scores it against a job when the user picks it.
 */
export async function createResumeFromParse(db: Database, identity: Identity, parseId: string): Promise<Resume> {
  if (!UUID.test(parseId)) throw errors.notFound('resume parse');
  return db.withUser(identity, async (tx) => {
    const parse = await tx
      .selectFrom('resume_parses as p')
      .innerJoin('uploads as u', 'u.id', 'p.upload_id')
      .select(['p.id', 'p.status', 'p.document', 'p.resume_id', 'u.file_name'])
      .where('p.id', '=', parseId)
      .forUpdate()
      .executeTakeFirst();
    if (!parse) throw errors.notFound('resume parse');
    if (parse.resume_id) {
      const made = await resumeCard(tx, parse.resume_id).catch(() => null);
      if (made) return made;
    }
    if (parse.status !== 'ready') throw errors.conflict('This resume has not finished reading.');
    const doc = canonicalResumeSchema.safeParse(parse.document);
    // Read before uploads kept their document, or nothing in it was a resume: say so plainly.
    if (!doc.success || (doc.data.roles.length === 0 && doc.data.education.length === 0 && !doc.data.summary)) {
      throw new AppError('UNREADABLE_FILE', 'We couldn’t find a resume to use in this file. Try uploading it again, or another file.');
    }

    const base = await tx.selectFrom('resumes').select('id').where('user_id', '=', identity.userId).where('is_base', '=', true).where('trashed_at', 'is', null).executeTakeFirst();
    const title = (parse.file_name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Uploaded resume').slice(0, 200);
    const resume = await tx
      .insertInto('resumes')
      .values({ user_id: identity.userId, title, doc_type: 'resume', source: 'uploaded', is_base: !base })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeResumeVersion(tx, { userId: identity.userId, resumeId: resume.id, jdId: null, doc: doc.data, note: `Uploaded ${parse.file_name}`.slice(0, 300), createdBy: 'upload' });
    await tx.updateTable('resume_parses').set({ resume_id: resume.id }).where('id', '=', parse.id).execute();
    return resumeCard(tx, resume.id);
  });
}
