import type { Resume, ResumeDocType } from '@nextkin/shared/models/resume';
import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { AppError, errors } from '../http/errors';
import type { StoragePort } from '../storage/storage';
import { listResumes, resumeCard } from './resumeRead';
import { insertVersion, lockResume, writeResumeVersion } from './versions';

/**
 * Library operations (ImBackendImplementationPlan P10-01, P10-03; V2 §7.11). Delete is permanent,
 * as the apps promise ("gone for good"): the resume, its versions and its exported files go at
 * once, the files by reference. The 30-day trash exists on the server (trash, restore, the purge
 * job) for when a trash screen is designed; nothing in the apps reaches it yet.
 */

export interface LibraryDeps {
  db: Database;
  storage: StoragePort;
  exportsBucket: string;
}

export const TRASH_DAYS = 30;

const BLANK_RESUME = { schemaVersion: CANONICAL_SCHEMA_VERSION, skills: [], roles: [], education: [], certifications: [], projects: [] };
const BLANK_LETTER = { kind: 'cover_letter', schemaVersion: CANONICAL_SCHEMA_VERSION, tone: 'professional', greeting: '', paragraphs: [], signoff: '' };

export async function createDocument(db: Database, identity: Identity, input: { title: string; docType: ResumeDocType }): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const row = await tx
      .insertInto('resumes')
      .values({ user_id: identity.userId, title: input.title.trim().slice(0, 200), doc_type: input.docType, source: 'manual' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await insertVersion(tx, { userId: identity.userId, resumeId: row.id, content: input.docType === 'cover_letter' ? BLANK_LETTER : BLANK_RESUME, note: 'Created', createdBy: 'user' });
    return resumeCard(tx, row.id);
  });
}

export async function renameDocument(db: Database, identity: Identity, id: string, title: string): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const done = await tx.updateTable('resumes').set({ title: title.trim().slice(0, 200) }).where('id', '=', id).where('trashed_at', 'is', null).returning('id').executeTakeFirst();
    if (!done) throw errors.notFound('resume');
    return resumeCard(tx, id);
  });
}

/** An independent copy at version 1, carrying content, template and JD linkage (§7.11). */
export async function duplicateDocument(db: Database, identity: Identity, id: string): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const source = await tx
      .selectFrom('resumes as r')
      .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.title', 'r.doc_type', 'r.source', 'r.template_id', 'r.job_description_id', 'r.target_company', 'r.target_role', 'r.tags', 'v.id as version_id', 'v.content'])
      .where('r.id', '=', id)
      .where('r.trashed_at', 'is', null)
      .executeTakeFirst();
    if (!source) throw errors.notFound('resume');
    const copy = await tx
      .insertInto('resumes')
      .values({
        user_id: identity.userId,
        title: `${source.title} (copy)`.slice(0, 200),
        doc_type: source.doc_type,
        source: source.source,
        template_id: source.template_id,
        job_description_id: source.job_description_id,
        target_company: source.target_company,
        target_role: source.target_role,
        tags: source.tags,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const note = `Duplicated from "${source.title}"`;
    if (source.doc_type === 'cover_letter') {
      await insertVersion(tx, { userId: identity.userId, resumeId: copy.id, content: source.content as object, note, createdBy: 'user' });
      const letter = await tx.selectFrom('cover_letters').select(['source_version_id', 'job_description_id', 'tone']).where('resume_id', '=', id).orderBy('created_at', 'desc').executeTakeFirst();
      await tx
        .insertInto('cover_letters')
        .values({ user_id: identity.userId, resume_id: copy.id, source_version_id: letter?.source_version_id ?? null, job_description_id: letter?.job_description_id ?? null, tone: letter?.tone ?? 'professional', content: JSON.stringify(source.content) })
        .execute();
    } else {
      const scored = await tx.selectFrom('ats_reports').select('id').where('resume_version_id', '=', source.version_id).executeTakeFirst();
      await writeResumeVersion(tx, { userId: identity.userId, resumeId: copy.id, jdId: source.job_description_id, doc: canonicalResumeSchema.parse(source.content), note, createdBy: 'user', score: !!scored });
    }
    return resumeCard(tx, copy.id);
  });
}

/** Moves the "Base" flag; two documents change, so the whole list comes back. */
export async function setAsBase(db: Database, identity: Identity, id: string): Promise<Resume[]> {
  await db.withUser(identity, async (tx) => {
    const row = await tx.selectFrom('resumes').select(['doc_type']).where('id', '=', id).where('trashed_at', 'is', null).executeTakeFirst();
    if (!row || row.doc_type !== 'resume') throw errors.notFound('resume');
    await tx.updateTable('resumes').set({ is_base: false }).where('user_id', '=', identity.userId).where('is_base', '=', true).execute();
    await tx.updateTable('resumes').set({ is_base: true }).where('id', '=', id).execute();
  });
  return listResumes(db, identity);
}

/** The current version is confirmed accurate (§15 risk 2), once; a later version asks again. */
export async function confirmAccuracy(db: Database, identity: Identity, id: string): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const row = await lockResume(tx, id);
    if (!row.current_version_id) throw new AppError('CONFLICT', 'This document is still being written.');
    await tx.updateTable('resume_versions').set({ accuracy_confirmed_at: new Date() }).where('id', '=', row.current_version_id).where('accuracy_confirmed_at', 'is', null).execute();
    return resumeCard(tx, id);
  });
}

/**
 * Deletes documents with everything they own: the files first (by the reference each export or render
 * recorded), then the rows, whose versions, reports and export records cascade. A failed file
 * delete stops the purge before any row goes, so nothing is left pointing at a missing file and no
 * file is left without its owner.
 */
export async function purgeDocuments(tx: Tx, deps: Pick<LibraryDeps, 'storage' | 'exportsBucket'>, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const files = await tx.selectFrom('export_events').select('object_key').where('resume_id', 'in', ids).where('object_key', 'is not', null).execute();
  for (const file of files) await deps.storage.remove(deps.exportsBucket, file.object_key!);
  // The typeset PDFs and page images (toreview §111), by the keys each render recorded.
  const renders = await tx.selectFrom('resume_renders').select(['pdf_key', 'page_keys']).where('resume_id', 'in', ids).where('pdf_key', 'is not', null).execute();
  for (const render of renders) {
    for (const key of [render.pdf_key!, ...((render.page_keys ?? []) as { key: string }[]).map((p) => p.key)]) await deps.storage.remove(deps.exportsBucket, key);
  }
  const gone = await tx.deleteFrom('resumes').where('id', 'in', ids).returning('id').execute();
  return gone.length;
}

/** "Delete" in the apps: permanent and immediate. */
export async function removeDocument(deps: LibraryDeps, identity: Identity, id: string): Promise<void> {
  await deps.db.withUser(identity, async (tx) => {
    const row = await tx.selectFrom('resumes').select('id').where('id', '=', id).executeTakeFirst();
    if (!row) throw errors.notFound('resume');
    await purgeDocuments(tx, deps, [id]);
  });
}

/** Server-only until a trash screen is designed: recoverable for 30 days, then purged. */
export async function trashDocument(db: Database, identity: Identity, id: string): Promise<void> {
  const done = await db.withUser(identity, (tx) =>
    tx.updateTable('resumes').set({ trashed_at: new Date(), is_base: false }).where('id', '=', id).where('trashed_at', 'is', null).returning('id').executeTakeFirst(),
  );
  if (!done) throw errors.notFound('resume');
}

export async function restoreFromTrash(db: Database, identity: Identity, id: string): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const done = await tx.updateTable('resumes').set({ trashed_at: null }).where('id', '=', id).where('trashed_at', 'is not', null).returning('id').executeTakeFirst();
    if (!done) throw errors.notFound('resume');
    return resumeCard(tx, id);
  });
}

export async function listTrash(db: Database, identity: Identity): Promise<{ id: string; title: string; trashedAt: string; purgeAt: string }[]> {
  const rows = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('resumes')
      .select(['id', 'title', 'trashed_at', sql<Date>`trashed_at + make_interval(days => ${TRASH_DAYS})`.as('purge_at')])
      .where('trashed_at', 'is not', null)
      .orderBy('trashed_at', 'desc')
      .execute(),
  );
  return rows.map((r) => ({ id: r.id, title: r.title, trashedAt: r.trashed_at!.toISOString(), purgeAt: new Date(r.purge_at).toISOString() }));
}
