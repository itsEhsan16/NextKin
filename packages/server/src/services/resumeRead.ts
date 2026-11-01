import type { AtsScore, Resume, ResumeVersion, VersionChange } from '@nextkin/shared/models/resume';
import { contentNeedsReview, type DocumentContent, type LineSource } from '@nextkin/shared/models/resumeContent';
import { toLetterContent, toResumeContent } from '@nextkin/shared/scoring/canonical';
import { lineSourcesOf } from '@nextkin/shared/scoring/lineSources';
import { exportProblem } from '@nextkin/shared/scoring/resumeDocumentCheck';
import { versionChanges, type VersionActor } from '@nextkin/shared/scoring/versionChanges';
import { canonicalLetterSchema, canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { readCheckpoint } from '../pipeline/snapshot';
import { planOf } from './plan';

/**
 * The library as the apps model it (ImBackendImplementationPlan P10-01, P10-13; V2 §7.11). A resume
 * row and its current version become a `Resume` card; the version's canonical JSON becomes the
 * editor's `DocumentContent`; the latest ATS report on that version is the score panel. Trashed
 * documents are invisible here (the trash has its own route).
 */

type ReportBasis = { panel?: AtsScore | null; validation?: Resume['validation']; completeness?: number } | null;

const SELECT = [
  'r.id',
  'r.title',
  'r.doc_type',
  'r.source',
  'r.is_base',
  'r.target_company',
  'r.target_role',
  'r.tags',
  'r.job_description_id',
  'r.created_at',
  'r.updated_at',
  'r.archived_at',
  'v.id as version_id',
  'v.content',
  'v.created_at as version_at',
  'v.accuracy_confirmed_at',
  'jd.job_id as linked_job_id',
] as const;

const rows = (tx: Tx) =>
  tx
    .selectFrom('resumes as r')
    .leftJoin('resume_versions as v', 'v.id', 'r.current_version_id')
    .leftJoin('job_descriptions as jd', 'jd.id', 'r.job_description_id')
    .select(SELECT)
    .where('r.trashed_at', 'is', null);

type Row = Awaited<ReturnType<ReturnType<typeof rows>['execute']>>[number];

/** The editor's body for a version: a resume's canonical JSON or a letter's. */
export function contentOf(docType: string, content: unknown, ids: { resumeId: string; versionId: string; sourceResumeId?: string | null }): DocumentContent | null {
  if (docType === 'cover_letter') {
    const letter = canonicalLetterSchema.safeParse(content);
    return letter.success ? toLetterContent(letter.data, { resumeId: ids.sourceResumeId ?? ids.resumeId, versionId: ids.versionId }) : null;
  }
  const resume = canonicalResumeSchema.safeParse(content);
  return resume.success ? toResumeContent(resume.data, ids) : null;
}

/** Everything a page of cards needs, in four queries however long the list. */
/**
 * "Draft" means not ready to download yet (toreview §124): a resume the export check would stop —
 * nothing on it, or an entry missing what it is. The name is left out of the check, as the
 * account supplies one. A cover letter made by hand is a draft until its first edit.
 */
function isDraft(row: Row, versions: number): boolean {
  if (!row.version_id) return false;
  if (row.doc_type === 'resume') {
    const parsed = canonicalResumeSchema.safeParse(row.content);
    return parsed.success && exportProblem(parsed.data, { name: '—' }) !== null;
  }
  return row.source === 'manual' && !row.job_description_id && versions <= 1;
}

async function cards(tx: Tx, list: Row[]): Promise<Resume[]> {
  if (list.length === 0) return [];
  const ids = list.map((r) => r.id);
  const versionIds = list.map((r) => r.version_id).filter((v): v is string => !!v);
  const [counts, reports, running] = await Promise.all([
    tx.selectFrom('resume_versions').select(['resume_id', (eb) => eb.fn.countAll<string>().as('n')]).where('resume_id', 'in', ids).groupBy('resume_id').execute(),
    versionIds.length
      ? tx.selectFrom('ats_reports').distinctOn('resume_version_id').select(['resume_version_id', 'basis']).where('resume_version_id', 'in', versionIds).orderBy('resume_version_id').orderBy('created_at', 'desc').execute()
      : Promise.resolve([]),
    tx.selectFrom('generations').distinctOn('resume_id').select(['resume_id', 'status']).where('resume_id', 'in', ids).orderBy('resume_id').orderBy('created_at', 'desc').execute(),
  ]);
  return list.map((row) => {
    const basis = (reports.find((r) => r.resume_version_id === row.version_id)?.basis ?? null) as ReportBasis;
    const run = running.find((g) => g.resume_id === row.id);
    const content = row.version_id ? contentOf(row.doc_type, row.content, { resumeId: row.id, versionId: row.version_id }) : null;
    const panel = basis?.panel ?? undefined;
    const status = row.version_id ? 'ready' : ((run?.status ?? 'queued') as Resume['status']);
    return {
      id: row.id,
      title: row.title,
      docType: row.doc_type as Resume['docType'],
      ...(row.is_base ? { isBase: true } : {}),
      ...(row.target_company ? { targetCompany: row.target_company } : {}),
      ...(row.target_role ? { targetRole: row.target_role } : {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: (row.version_at ?? row.updated_at).toISOString(),
      versionCount: Number(counts.find((c) => c.resume_id === row.id)?.n ?? 0),
      currentVersionId: row.version_id ?? '',
      ...(panel ? { atsScore: panel.total } : {}),
      ...(basis?.validation ? { validation: basis.validation } : {}),
      ...(typeof basis?.completeness === 'number' ? { completeness: basis.completeness } : {}),
      status,
      tags: row.tags ?? [],
      ...(row.linked_job_id ? { linkedJobId: row.linked_job_id } : {}),
      variant: row.job_description_id ? 'tailored' : 'default',
      ...(isDraft(row, Number(counts.find((c) => c.resume_id === row.id)?.n ?? 0)) ? { draft: true } : {}),
      ...(content && contentNeedsReview(content) ? { needsReview: true } : {}),
      ...(row.archived_at ? { archived: true } : {}),
      ...(row.accuracy_confirmed_at ? { accuracyConfirmed: true } : {}),
    } satisfies Resume;
  });
}

export async function resumeCard(tx: Tx, id: string): Promise<Resume> {
  const row = await rows(tx).where('r.id', '=', id).executeTakeFirst();
  if (!row) throw errors.notFound('resume');
  const [card] = await cards(tx, [row]);
  return card!;
}

export async function listResumes(db: Database, identity: Identity): Promise<Resume[]> {
  return db.withUser(identity, async (tx) => cards(tx, await rows(tx).orderBy('r.updated_at', 'desc').limit(200).execute()));
}

export const getResume = (db: Database, identity: Identity, id: string): Promise<Resume> => db.withUser(identity, (tx) => resumeCard(tx, id));

/** The current version's body, with the contact line read from the account at the time of reading. */
export async function readContent(tx: Tx, userId: string, id: string): Promise<DocumentContent> {
  const row = await rows(tx).where('r.id', '=', id).executeTakeFirst();
  if (!row) throw errors.notFound('resume');
  if (!row.version_id) throw errors.notFound('content'); // still being written by its run
  let sourceResumeId: string | null = null;
  if (row.doc_type === 'cover_letter') {
    const letter = await tx
      .selectFrom('cover_letters as c')
      .leftJoin('resume_versions as sv', 'sv.id', 'c.source_version_id')
      .select(['sv.resume_id'])
      .where('c.resume_id', '=', id)
      .orderBy('c.created_at', 'desc')
      .executeTakeFirst();
    sourceResumeId = letter?.resume_id ?? null;
  }
  const content = contentOf(row.doc_type, row.content, { resumeId: row.id, versionId: row.version_id, sourceResumeId });
  if (!content) throw errors.notFound('content');
  if (content.kind === 'resume') {
    const who = await tx.selectFrom('users as u').leftJoin('profiles as p', 'p.user_id', 'u.id').select(['u.email', 'p.phone', 'p.location']).where('u.id', '=', userId).executeTakeFirst();
    const contact = { ...(who?.email ? { email: who.email } : {}), ...(who?.phone ? { phone: who.phone } : {}), ...(who?.location ? { location: who.location } : {}) };
    if (Object.keys(contact).length) content.contact = contact;
  }
  return content;
}

export const getContent = (db: Database, identity: Identity, id: string): Promise<DocumentContent> => db.withUser(identity, (tx) => readContent(tx, identity.userId, id));

export async function getScore(db: Database, identity: Identity, id: string): Promise<AtsScore> {
  return db.withUser(identity, async (tx) => {
    const row = await rows(tx).where('r.id', '=', id).executeTakeFirst();
    if (!row) throw errors.notFound('resume');
    const report = row.version_id
      ? await tx.selectFrom('ats_reports').select('basis').where('resume_version_id', '=', row.version_id).orderBy('created_at', 'desc').executeTakeFirst()
      : undefined;
    const panel = (report?.basis as ReportBasis)?.panel;
    if (!panel) throw errors.notFound('score'); // a blank or unscored document has no score
    return panel;
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where each line of the current version came from (toreview §146.4). A tailored version's claims
 * cite the lines of the version it was made from, which its ledger names; an edit after it keeps
 * those citations, so the newest version that names a base is the one to read them against.
 */
export async function getLineSources(db: Database, identity: Identity, id: string): Promise<LineSource[]> {
  return db.withUser(identity, async (tx) => {
    const row = await rows(tx).where('r.id', '=', id).executeTakeFirst();
    if (!row) throw errors.notFound('resume');
    if (!row.version_id) return [];
    const current = await tx.selectFrom('resume_versions').select(['content', 'version_number']).where('id', '=', row.version_id).executeTakeFirstOrThrow();
    const doc = canonicalResumeSchema.safeParse(current.content);
    if (!doc.success) return []; // a cover letter has no lines of this kind
    const history = await tx
      .selectFrom('resume_versions')
      .select('claim_ledger')
      .where('resume_id', '=', id)
      .where('version_number', '<=', current.version_number)
      .orderBy('version_number', 'desc')
      .execute();
    const baseId = history.map((v) => (v.claim_ledger as { basis?: { versionId?: string } } | null)?.basis?.versionId).find(Boolean);
    const base = baseId ? await tx.selectFrom('resume_versions').select('content').where('id', '=', baseId).executeTakeFirst() : undefined;
    const parsed = base ? canonicalResumeSchema.safeParse(base.content) : undefined;
    return lineSourcesOf(doc.data, parsed?.success ? parsed.data : undefined);
  });
}

/**
 * What one version changed against the one it was made from, and why (toreview §146.5): the version
 * a tailored run names as its base, else the one before it. The run's check says what it took out.
 */
export async function getVersionChanges(db: Database, identity: Identity, id: string, versionId: string): Promise<VersionChange[]> {
  if (!UUID.test(versionId)) throw errors.notFound('resume version'); // not a 500 from the uuid cast
  return db.withUser(identity, async (tx) => {
    const version = await tx
      .selectFrom('resume_versions')
      .select(['content', 'version_number', 'created_by', 'claim_ledger', 'generation_id'])
      .where('id', '=', versionId)
      .where('resume_id', '=', id)
      .executeTakeFirst();
    if (!version) throw errors.notFound('resume version');
    const after = canonicalResumeSchema.safeParse(version.content);
    if (!after.success) return []; // a cover letter has no lines of this kind

    const baseId = (version.claim_ledger as { basis?: { versionId?: string } } | null)?.basis?.versionId;
    const earlier = await (baseId
      ? tx.selectFrom('resume_versions').select('content').where('id', '=', baseId)
      : tx.selectFrom('resume_versions').select('content').where('resume_id', '=', id).where('version_number', '<', version.version_number).orderBy('version_number', 'desc').limit(1)
    ).executeTakeFirst();
    const parsed = earlier ? canonicalResumeSchema.safeParse(earlier.content) : undefined;
    const before = parsed?.success ? parsed.data : undefined;

    const run = version.generation_id
      ? await tx.selectFrom('generations').select('checkpoint').where('id', '=', version.generation_id).executeTakeFirst()
      : undefined;
    const validated = run ? (readCheckpoint(run).outputs.validate as { stripped?: { text?: string; reason: string }[] } | undefined) : undefined;
    const dropped = (validated?.stripped ?? []).flatMap((line) => (line.text ? [{ text: line.text, reason: line.reason }] : []));

    const ids = { resumeId: id, versionId };
    const rewordedFrom = new Map(before ? lineSourcesOf(after.data, before).flatMap((line) => (line.before ? [[line.text, line.before] as const] : [])) : []);
    return versionChanges({
      before: before ? toResumeContent(before, ids) : undefined,
      after: toResumeContent(after.data, ids),
      actor: version.created_by as VersionActor,
      rewordedFrom,
      dropped,
    });
  });
}

/** Newest first. Beyond the plan's cap a version is locked: kept, listed, not restorable (§7.11). */
export async function getVersions(db: Database, identity: Identity, id: string): Promise<ResumeVersion[]> {
  return db.withUser(identity, async (tx) => {
    const exists = await tx.selectFrom('resumes').select('id').where('id', '=', id).where('trashed_at', 'is', null).executeTakeFirst();
    if (!exists) throw errors.notFound('resume');
    const plan = await planOf(tx, identity.userId);
    const list = await tx
      .selectFrom('resume_versions')
      .select(['id', 'resume_id', 'version_number', 'created_at', 'change_note', 'created_by'])
      .where('resume_id', '=', id)
      .orderBy('version_number', 'desc')
      .execute();
    return list.map((v, index) => ({
      id: v.id,
      resumeId: v.resume_id,
      version: v.version_number,
      createdAt: v.created_at.toISOString(),
      ...(v.change_note ? { changeNote: v.change_note } : {}),
      actor: v.created_by as NonNullable<ResumeVersion['actor']>,
      ...(index >= plan.versionsVisible ? { locked: true } : {}),
    }));
  });
}

/** The content's ETag source: the resume row's version, which every save bumps. */
export async function resumeRowVersion(db: Database, identity: Identity, id: string): Promise<number> {
  const row = await db.withUser(identity, (tx) => tx.selectFrom('resumes').select('row_version').where('id', '=', id).executeTakeFirst());
  if (!row) throw errors.notFound('resume');
  return row.row_version;
}
