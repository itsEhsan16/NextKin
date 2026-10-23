import type { AtsScore, Resume } from '@nextkin/shared/models/resume';
import { RESUME_SECTION_LABEL, type DocumentContent, type ResumeContent, type ResumeSectionKey } from '@nextkin/shared/models/resumeContent';
import type { ProfileDraft } from '@nextkin/shared/models/profile';
import { zeroProgress, type ZeroCheckResult, type ZeroResolution } from '@nextkin/shared/models/zeroResume';
import { toResumeContent } from '@nextkin/shared/scoring/canonical';
import { applySection, applySkillFix, applyZeroAnswer, CanonicalEditError } from '@nextkin/shared/scoring/canonicalEdits';
import { canonicalLetterSchema, canonicalResumeSchema, type CanonicalClaim, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import type { CoverLetterPatch } from '@nextkin/shared/repos/types';
import { sectionValueSchemas } from '@nextkin/shared/schemas/resumeEdit';

import type { Database, Identity, Tx } from '../db/database';
import { requireIfMatch } from '../http/etag';
import { AppError, errors } from '../http/errors';
import { planOf } from './plan';
import { applyDraft } from './profile';
import { readContent, resumeCard } from './resumeRead';
import { insertVersion, lockResume, writeResumeVersion } from './versions';

/**
 * Content operations (ImBackendImplementationPlan P10-02, P10-09, P10-10; V2 §7.9–§7.11). Each is a
 * new immutable version with its checks, re-scored when the document was scored before. Writes may
 * carry `If-Match` with the content's ETag (the resume's row version); a stale one is refused.
 */

type Locked = Awaited<ReturnType<typeof lockResume>>;

const editError = (error: unknown): never => {
  if (error instanceof CanonicalEditError) throw error.code === 'ZERO_BLANK' ? new AppError('ZERO_BLANK', error.message) : errors.notFound('entry');
  throw error;
};

async function currentResume(tx: Tx, id: string, ifMatch?: string): Promise<{ row: Locked; doc: CanonicalResumeJson }> {
  const row = await lockResume(tx, id);
  if (ifMatch !== undefined) requireIfMatch(ifMatch, row.row_version);
  if (row.doc_type !== 'resume' || !row.current_version_id) throw errors.notFound('resume section');
  const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', row.current_version_id).executeTakeFirstOrThrow();
  const parsed = canonicalResumeSchema.safeParse(version.content);
  if (!parsed.success) throw errors.notFound('resume section');
  return { row, doc: parsed.data };
}

const valid = (doc: CanonicalResumeJson): CanonicalResumeJson => {
  const parsed = canonicalResumeSchema.safeParse(doc);
  if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'That change does not fit a resume.', parsed.error.issues.slice(0, 5));
  return parsed.data;
};

export async function updateSection(db: Database, identity: Identity, id: string, section: ResumeSectionKey, value: unknown, ifMatch?: string): Promise<DocumentContent> {
  const parsed = sectionValueSchemas[section].safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'That section is not in the expected shape.', parsed.error.issues.slice(0, 5));
  return db.withUser(identity, async (tx) => {
    const { row, doc } = await currentResume(tx, id, ifMatch);
    const next = valid(applySection(doc, section, parsed.data as ResumeContent[typeof section]));
    await writeResumeVersion(tx, { userId: identity.userId, resumeId: id, jdId: row.job_description_id, doc: next, note: `Edited ${RESUME_SECTION_LABEL[section]}`, createdBy: 'user' });
    return readContent(tx, identity.userId, id);
  });
}

/** Lines left as they were keep their claims; changed or new ones are the user's (Q-03). */
function letterParagraphs(previous: readonly CanonicalClaim[], paragraphs: readonly string[]): CanonicalClaim[] {
  const pool = [...previous];
  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, i) => {
      const at = pool.findIndex((c) => c.text === text);
      return at >= 0 ? pool.splice(at, 1)[0]! : { id: `u${i}-${Date.now().toString(36)}`, text, evidence: [], origin: 'user' as const };
    });
}

export async function updateLetter(db: Database, identity: Identity, id: string, patch: CoverLetterPatch, ifMatch?: string): Promise<DocumentContent> {
  return db.withUser(identity, async (tx) => {
    const row = await lockResume(tx, id);
    if (ifMatch !== undefined) requireIfMatch(ifMatch, row.row_version);
    if (row.doc_type !== 'cover_letter' || !row.current_version_id) throw errors.notFound('cover letter');
    const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', row.current_version_id).executeTakeFirstOrThrow();
    const letter = canonicalLetterSchema.parse(version.content);
    const next = canonicalLetterSchema.parse({
      ...letter,
      ...(patch.greeting !== undefined ? { greeting: patch.greeting } : {}),
      ...(patch.signoff !== undefined ? { signoff: patch.signoff } : {}),
      ...(patch.tone ? { tone: patch.tone } : {}),
      ...(patch.paragraphs ? { paragraphs: letterParagraphs(letter.paragraphs, patch.paragraphs) } : {}),
    });
    await insertVersion(tx, { userId: identity.userId, resumeId: id, content: next, note: 'Edited letter', createdBy: 'user' });
    await tx.updateTable('cover_letters').set({ content: JSON.stringify(next), tone: next.tone }).where('resume_id', '=', id).execute();
    return readContent(tx, identity.userId, id);
  });
}

async function scoreOf(tx: Tx, versionId: string): Promise<AtsScore | null> {
  const report = await tx.selectFrom('ats_reports').select('basis').where('resume_version_id', '=', versionId).orderBy('created_at', 'desc').executeTakeFirst();
  return ((report?.basis as { panel?: AtsScore | null } | null)?.panel ?? null) as AtsScore | null;
}

/** A typed fix from the current score panel (C-10): only a skill the profile backs applies. */
export async function applyAtsFix(db: Database, identity: Identity, id: string, itemId: string): Promise<{ content: DocumentContent; score: AtsScore }> {
  return db.withUser(identity, async (tx) => {
    const { row, doc } = await currentResume(tx, id);
    const panel = await scoreOf(tx, row.current_version_id!);
    const item = panel?.sections.flatMap((s) => s.items).find((i) => i.id === itemId);
    const fix = item?.fixable && item.fixId ? panel?.report?.fixes.find((f) => f.id === item.fixId) : undefined;
    if (!fix || !fix.insertable || fix.type !== 'surface_backed_skill') throw errors.notFound('fix');
    let next: CanonicalResumeJson;
    try {
      next = valid(applySkillFix(doc, fix));
    } catch (error) {
      return editError(error);
    }
    const versionId = await writeResumeVersion(tx, { userId: identity.userId, resumeId: id, jdId: row.job_description_id, doc: next, note: 'Applied fix', createdBy: 'user', score: true });
    const score = await scoreOf(tx, versionId);
    return { content: await readContent(tx, identity.userId, id), score: score ?? panel! };
  });
}

/** Restoring writes version n+1 with the old body, re-scored under the current method (§7.11, Q-01). */
export async function restoreVersion(db: Database, identity: Identity, id: string, versionId: string): Promise<Resume> {
  return db.withUser(identity, async (tx) => {
    const row = await lockResume(tx, id);
    const versions = await tx.selectFrom('resume_versions').select(['id', 'version_number', 'content']).where('resume_id', '=', id).orderBy('version_number', 'desc').execute();
    const at = versions.findIndex((v) => v.id === versionId);
    const target = versions[at];
    if (!target) throw errors.notFound('version');
    const plan = await planOf(tx, identity.userId);
    if (at >= plan.versionsVisible) throw new AppError('PLAN_LOCKED', `Versions older than the last ${plan.versionsVisible} need NextKin Pro.`);
    const note = `Restored v${target.version_number}`;
    if (row.doc_type === 'cover_letter') {
      await insertVersion(tx, { userId: identity.userId, resumeId: id, content: target.content as object, note, createdBy: 'restore' });
      await tx.updateTable('cover_letters').set({ content: JSON.stringify(target.content) }).where('resume_id', '=', id).execute();
    } else {
      await writeResumeVersion(tx, { userId: identity.userId, resumeId: id, jdId: row.job_description_id, doc: canonicalResumeSchema.parse(target.content), note, createdBy: 'restore' });
    }
    return resumeCard(tx, id);
  });
}

const ZERO_NOTE: Record<ZeroResolution['kind'], string> = { role: 'Checked a role', skill: 'Checked a skill', education: 'Checked education' };

const dayOf = (iso: string | null | undefined) => (iso ? `${iso.length === 4 ? `${iso}-01` : iso}-01` : undefined);

/** What a finished Zero Resume review puts on the profile, through the §7.4 confirm-to-commit path. */
function draftOf(doc: CanonicalResumeJson): ProfileDraft {
  return {
    skills: doc.skills.map((s) => s.name),
    experiences: doc.roles.map((r) => ({ id: r.roleId, company: r.company, title: r.title, startDate: dayOf(r.start) ?? '', ...(r.end ? { endDate: dayOf(r.end)! } : {}), current: r.end === null, skills: [...r.skills] })),
    education: doc.education.map((e) => ({ id: e.factId, institution: e.institution, degree: e.degree, startDate: dayOf(e.start ?? null) ?? '', ...(e.end ? { endDate: dayOf(e.end)! } : {}), current: e.end === null })),
  };
}

/** One answer; the last one opens the download gate and fills the profile with what was confirmed. */
export async function resolveZeroCheck(db: Database, identity: Identity, id: string, answer: ZeroResolution): Promise<ZeroCheckResult> {
  const done = await db.withUser(identity, async (tx) => {
    const { row, doc } = await currentResume(tx, id);
    if (!doc.review) throw errors.notFound('Zero Resume review');
    let next: CanonicalResumeJson;
    try {
      next = valid(applyZeroAnswer(doc, answer));
    } catch (error) {
      return editError(error);
    }
    await writeResumeVersion(tx, { userId: identity.userId, resumeId: id, jdId: row.job_description_id, doc: next, note: ZERO_NOTE[answer.kind], createdBy: 'zero_review' });
    const finished = zeroProgress(toResumeContent(next, { resumeId: id, versionId: '' })).left === 0;
    return { next, finished };
  });
  if (done.finished) await applyDraft(db, identity, draftOf(done.next));
  return db.withUser(identity, async (tx) => {
    const content = (await readContent(tx, identity.userId, id)) as ResumeContent;
    return { content, resume: await resumeCard(tx, id), finished: done.finished };
  });
}
