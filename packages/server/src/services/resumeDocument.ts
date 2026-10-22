import type { ResumeDocument, ResumeDocumentWrite } from '@nextkin/shared/models/resumeDocument';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { applyDocument, documentOf, type DocumentOwner } from '@nextkin/shared/scoring/resumeDocument';

import type { Database, Identity, Tx } from '../db/database';
import { AppError, errors } from '../http/errors';
import { lockResume, writeResumeVersion } from './versions';

/**
 * The resume editor's document (toreview §124): read whole, saved whole.
 *
 * - A save names the revision it was edited from (the version id and its content hash); a save
 *   from an older one is refused with PRECONDITION_FAILED, so two tabs never write over each
 *   other silently.
 * - Autosave would otherwise mint a version every few seconds and push the versions a user means
 *   out of the plan's visible history. So an editor save replaces the editor's previous save of
 *   the same sitting — same note, under 30 minutes old, and nothing yet depends on it (no
 *   confirmation, export, letter or shared report) — at the same version number. Versions stay
 *   immutable: the old row is deleted and the new one written, in one transaction (the current
 *   version pointer is checked at commit).
 */

export const EDITOR_NOTE = 'Edited in the editor';
const SITTING_MS = 30 * 60 * 1000;

export async function ownerOf(tx: Tx, userId: string): Promise<DocumentOwner> {
  const u = await tx.selectFrom('users as u').leftJoin('profiles as p', 'p.user_id', 'u.id').select(['u.first_name', 'u.last_name', 'u.email', 'p.phone', 'p.location']).where('u.id', '=', userId).executeTakeFirstOrThrow();
  return { name: `${u.first_name} ${u.last_name}`.trim(), email: u.email, ...(u.phone ? { phone: u.phone } : {}), ...(u.location ? { location: u.location } : {}) };
}

const revisionOf = (version: { id: string; content_hash: string }) => `${version.id}:${version.content_hash.slice(0, 16)}`;

async function current(tx: Tx, id: string, lock: boolean) {
  const row = lock ? await lockResume(tx, id) : await tx.selectFrom('resumes').select(['id', 'doc_type', 'job_description_id', 'current_version_id']).where('id', '=', id).where('trashed_at', 'is', null).executeTakeFirst();
  if (!row) throw errors.notFound('resume');
  if (row.doc_type !== 'resume') throw errors.notFound('resume document');
  if (!row.current_version_id) throw errors.notFound('content'); // still being written by its run
  const version = await tx
    .selectFrom('resume_versions')
    .select(['id', 'version_number', 'content', 'content_hash', 'created_by', 'change_note', 'created_at', 'accuracy_confirmed_at'])
    .where('id', '=', row.current_version_id)
    .executeTakeFirstOrThrow();
  const parsed = canonicalResumeSchema.safeParse(version.content);
  if (!parsed.success) throw errors.notFound('resume document');
  return { row, version, doc: parsed.data };
}

export async function getDocument(db: Database, identity: Identity, id: string): Promise<ResumeDocument> {
  return db.withUser(identity, async (tx) => {
    const { version, doc } = await current(tx, id, false);
    return documentOf(doc, { resumeId: id, versionId: version.id, revision: revisionOf(version) }, await ownerOf(tx, identity.userId));
  });
}

/** The editor's previous save of this sitting, which nothing depends on yet. */
async function replaceable(tx: Tx, resumeId: string, version: Awaited<ReturnType<typeof current>>['version']): Promise<boolean> {
  if (version.created_by !== 'user' || version.change_note !== EDITOR_NOTE || version.accuracy_confirmed_at) return false;
  if (Date.now() - new Date(version.created_at).getTime() > SITTING_MS) return false;
  const newest = await tx.selectFrom('resume_versions').select((eb) => eb.fn.max('version_number').as('max')).where('resume_id', '=', resumeId).executeTakeFirst();
  if (Number(newest?.max ?? 0) !== version.version_number) return false;
  const used = await Promise.all([
    tx.selectFrom('export_events').select('id').where('resume_version_id', '=', version.id).executeTakeFirst(),
    tx.selectFrom('cover_letters').select('id').where('source_version_id', '=', version.id).executeTakeFirst(),
    tx.selectFrom('shared_reports as s').innerJoin('ats_reports as a', 'a.id', 's.ats_report_id').select('s.id').where('a.resume_version_id', '=', version.id).executeTakeFirst(),
  ]);
  return used.every((u) => !u);
}

export async function saveDocument(db: Database, identity: Identity, id: string, write: ResumeDocumentWrite, baseRevision: string): Promise<ResumeDocument> {
  return db.withUser(identity, async (tx) => {
    const { row, version, doc } = await current(tx, id, true);
    if (revisionOf(version) !== baseRevision) throw new AppError('PRECONDITION_FAILED', 'This resume changed somewhere else since you opened it.');
    let next: CanonicalResumeJson;
    const parsed = canonicalResumeSchema.safeParse(applyDocument(doc, write));
    if (parsed.success) next = parsed.data;
    else throw new AppError('VALIDATION_FAILED', 'That change does not fit a resume.', parsed.error.issues.slice(0, 5));

    if (await replaceable(tx, id, version)) await tx.deleteFrom('resume_versions').where('id', '=', version.id).execute();
    const versionId = await writeResumeVersion(tx, { userId: identity.userId, resumeId: id, jdId: row.job_description_id, doc: next, note: EDITOR_NOTE, createdBy: 'user' });
    const saved = await tx.selectFrom('resume_versions').select(['id', 'content_hash']).where('id', '=', versionId).executeTakeFirstOrThrow();
    return documentOf(next, { resumeId: id, versionId, revision: revisionOf(saved) }, await ownerOf(tx, identity.userId));
  });
}
