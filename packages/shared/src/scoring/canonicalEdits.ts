import type { AtsFix } from '../models/resume';
import type {
  ContentEducation,
  ContentProject,
  ContentRole,
  ResumeContent,
  ResumeSectionKey,
} from '../models/resumeContent';
import type { ZeroDate, ZeroResolution } from '../models/zeroResume';
import type { CanonicalClaim, CanonicalResumeJson } from '../schemas/resumeContent';
import { reconcileStructure } from './structure';

/**
 * Edits on the canonical resume (ImBackendImplementationPlan P10-02, P10-10). The apps edit their
 * editor model (`models/resumeContent.ts`); the server stores the canonical JSON, where every claim
 * cites what it rests on. These functions write an editor-model section back onto the canonical
 * document without losing that: a line the user left alone keeps its claim, id, evidence and
 * origin, and a line they typed or changed becomes a `user` claim (Q-03). Saving a section by hand
 * confirms what Zero Resume assumed in it (V2 §7.9), as the mock's `confirmReviewed` does.
 *
 * Pure and phone-safe: the server runs exactly these, and the tests read them without a database.
 */

export class CanonicalEditError extends Error {
  constructor(
    readonly code: 'ZERO_BLANK' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'CanonicalEditError';
  }
}

const isBlank = (text: string): boolean => /^\s*(\[.*\])?\s*$/.test(text);
const refuseBlank = (what: string): never => {
  throw new CanonicalEditError('ZERO_BLANK', `Add the real ${what} — a blank can't stay.`);
};

/** Ids unique within the document: the claim ids already in use are never reused. */
function idMinter(doc: CanonicalResumeJson): (prefix: string) => string {
  const taken = new Set<string>([
    ...(doc.summary ? [doc.summary.id] : []),
    ...doc.skills.map((s) => s.id),
    ...doc.roles.flatMap((r) => [r.roleId, ...r.bullets.map((b) => b.id)]),
    ...doc.projects.flatMap((p) => [p.factId, ...p.bullets.map((b) => b.id)]),
    ...doc.education.map((e) => e.factId),
    ...doc.certifications.map((c) => c.factId),
  ]);
  return (prefix) => {
    let n = 0;
    while (taken.has(`${prefix}${n}`)) n += 1;
    const id = `${prefix}${n}`;
    taken.add(id);
    return id;
  };
}

const userClaim = (id: string, text: string): CanonicalClaim => ({ id, text: text.trim(), evidence: [], origin: 'user' });

/** Lines kept verbatim keep their claim; a changed or new line is the user's. */
function mergeLines(previous: readonly CanonicalClaim[], lines: readonly string[], mint: () => string, confirm: boolean): CanonicalClaim[] {
  const pool = [...previous];
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const at = pool.findIndex((c) => c.text === line.trim());
      if (at < 0) return userClaim(mint(), line);
      const [kept] = pool.splice(at, 1);
      return confirm && kept!.origin === 'assumed' ? { ...kept!, origin: 'user' as const } : kept!;
    });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2022" or "2019" back to YYYY-MM / YYYY; anything else is unreadable. */
function isoOfPrinted(text: string): string | null | undefined {
  const t = text.trim();
  if (/^present$/i.test(t)) return null;
  const m = /^(?:([A-Z][a-z]{2}) )?(\d{4})$/.exec(t);
  if (!m) return undefined;
  const month = m[1] ? MONTHS.indexOf(m[1]) + 1 : 0;
  if (m[1] && month === 0) return undefined;
  return month ? `${m[2]}-${String(month).padStart(2, '0')}` : m[2]!;
}

/** The dates an edited entry carries: structured fields first, then its printed period, then the old ones. */
function datesOf(entry: { start?: string; end?: string | null; period: string }, fallback: { start: string | null; end: string | null }) {
  if (entry.start !== undefined || entry.end !== undefined) return { start: entry.start ?? fallback.start, end: entry.end === undefined ? fallback.end : entry.end };
  const [from, to] = entry.period.split(/\s+[—–-]\s+/);
  const start = from ? isoOfPrinted(from) : undefined;
  const end = to ? isoOfPrinted(to) : undefined;
  return { start: start === undefined ? fallback.start : start, end: end === undefined ? fallback.end : end };
}

export const isoOfZeroDate = (d: ZeroDate | 'present'): string | null =>
  d === 'present' ? null : d.month ? `${d.year}-${String(d.month).padStart(2, '0')}` : String(d.year);

function withRoles(doc: CanonicalResumeJson, roles: readonly ContentRole[], mint: (p: string) => string): CanonicalResumeJson {
  return {
    ...doc,
    roles: roles.map((role) => {
      const old = doc.roles.find((r) => r.roleId === (role.roleId ?? role.id));
      const { start, end } = datesOf(role, { start: old?.start ?? null, end: old?.end ?? null });
      const roleId = old?.roleId ?? mint('user-r');
      return {
        roleId,
        company: role.company.trim() || old?.company || '[Company Name]',
        title: role.title.trim() || old?.title || '[Job Title]',
        start,
        end,
        ...(role.location ? { location: role.location } : old?.location ? { location: old.location } : {}),
        skills: [...(role.skills ?? old?.skills ?? [])],
        bullets: mergeLines(old?.bullets ?? [], role.bullets, () => mint(`${roleId}-u`), true),
        // The file's client projects stay; `reconcileStructure` drops what no longer exists.
        ...(old?.entries ? { entries: old.entries } : {}),
      };
    }),
  };
}

function withProjects(doc: CanonicalResumeJson, projects: readonly ContentProject[], mint: (p: string) => string): CanonicalResumeJson {
  return {
    ...doc,
    projects: projects.map((p) => {
      const old = doc.projects.find((x) => x.factId === p.id);
      const factId = old?.factId ?? mint('user-p');
      return {
        factId,
        name: p.name.trim() || old?.name || 'Project',
        ...(p.description.trim() ? { description: p.description.trim() } : {}),
        ...(old?.tech ? { tech: old.tech } : {}),
        ...(old?.start !== undefined ? { start: old.start } : {}),
        ...(old?.end !== undefined ? { end: old.end } : {}),
        bullets: mergeLines(old?.bullets ?? [], p.bullets, () => mint(`${factId}-u`), true),
      };
    }),
  };
}

function withEducation(doc: CanonicalResumeJson, entries: readonly ContentEducation[], mint: (p: string) => string): CanonicalResumeJson {
  return {
    ...doc,
    education: entries.map((e) => {
      const old = doc.education.find((x) => x.factId === e.id);
      const printedDegree = old ? [old.degree, old.field].filter(Boolean).join(' ') : '';
      const { start, end } = datesOf(e, { start: old?.start ?? null, end: old?.end ?? null });
      const keepDegree = old && e.degree.trim() === printedDegree;
      return {
        factId: old?.factId ?? mint('user-e'),
        institution: e.institution.trim() || old?.institution || '[Institution Name]',
        degree: keepDegree ? old.degree : e.degree.trim() || '[Degree]',
        ...(keepDegree && old.field ? { field: old.field } : {}),
        start,
        end,
        ...(old?.gpa ? { gpa: old.gpa } : {}),
        ...(old?.location ? { location: old.location } : {}),
      };
    }),
  };
}

/** The write itself; `applySection` wraps it. */
function applySectionRaw<K extends ResumeSectionKey>(doc: CanonicalResumeJson, section: K, value: ResumeContent[K]): CanonicalResumeJson {
  const mint = idMinter(doc);
  switch (section) {
    case 'summary': {
      const text = (value as string).trim();
      if (!text) {
        const { summary: _dropped, ...rest } = doc;
        return rest;
      }
      return { ...doc, summary: doc.summary?.text === text ? { ...doc.summary, ...(doc.summary.origin === 'assumed' ? { origin: 'user' as const } : {}) } : userClaim(doc.summary?.id ?? 's', text) };
    }
    case 'skills': {
      const names = (value as string[]).map((n) => n.trim()).filter(Boolean);
      const unique = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);
      const skills = unique.map((name) => {
        const old = doc.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (!old) return { id: mint('user-k'), name, evidence: [], origin: 'user' as const };
        return old.origin === 'assumed' ? { ...old, name, origin: 'user' as const } : { ...old, name };
      });
      // Saving the list answers every pending Zero Resume skill: kept ones confirmed, the rest removed.
      const dropped = doc.skills.filter((s) => s.origin === 'assumed' && !skills.some((k) => k.id === s.id)).map((s) => s.name);
      return { ...doc, skills, ...(doc.review ? { review: { ...doc.review, removedSkills: [...doc.review.removedSkills, ...dropped] } } : {}) };
    }
    case 'experience':
      return withRoles(doc, value as ContentRole[], mint);
    case 'projects':
      return withProjects(doc, value as ContentProject[], mint);
    case 'education':
      return withEducation(doc, value as ContentEducation[], mint);
    case 'certifications': {
      const names = (value as string[]).map((n) => n.trim()).filter(Boolean);
      return { ...doc, certifications: names.map((name) => doc.certifications.find((c) => c.name === name) ?? { factId: mint('user-c'), name }) };
    }
  }
  return doc;
}

/** One editor-model section written back onto the canonical document, its page structure kept in step. */
export const applySection = <K extends ResumeSectionKey>(doc: CanonicalResumeJson, section: K, value: ResumeContent[K]): CanonicalResumeJson =>
  reconcileStructure(applySectionRaw(doc, section, value));

/** One Zero Resume answer (V2 §7.9's edit, confirm or delete) on the canonical document. */
export function applyZeroAnswer(doc: CanonicalResumeJson, answer: ZeroResolution): CanonicalResumeJson {
  if (!doc.review) throw new CanonicalEditError('NOT_FOUND', 'This document has no Zero Resume review.');
  switch (answer.kind) {
    case 'role': {
      const role = doc.roles.find((r) => r.roleId === answer.roleId);
      if (!role) throw new CanonicalEditError('NOT_FOUND', 'That role is not on this draft.');
      if (answer.remove) return { ...doc, roles: doc.roles.filter((r) => r !== role) };
      if (isBlank(answer.title)) refuseBlank('job title');
      if (isBlank(answer.company)) refuseBlank('company');
      const { assumed: _answered, ...rest } = role;
      return {
        ...doc,
        roles: doc.roles.map((r) =>
          r === role
            ? { ...rest, title: answer.title.trim(), company: answer.company.trim(), start: isoOfZeroDate(answer.start), end: isoOfZeroDate(answer.end), bullets: r.bullets.map((b) => (b.origin === 'assumed' ? { ...b, origin: 'user' as const } : b)) }
            : r,
        ),
      };
    }
    case 'skill': {
      const skill = doc.skills.find((s) => s.origin === 'assumed' && s.name === answer.skill);
      if (!skill) throw new CanonicalEditError('NOT_FOUND', 'That skill is not waiting for an answer.');
      if (answer.remove) return { ...doc, skills: doc.skills.filter((s) => s !== skill), review: { ...doc.review, removedSkills: [...doc.review.removedSkills, skill.name] } };
      const name = answer.name.trim();
      if (!name) refuseBlank('skill');
      const duplicate = doc.skills.some((s) => s !== skill && s.name.toLowerCase() === name.toLowerCase());
      return { ...doc, skills: duplicate ? doc.skills.filter((s) => s !== skill) : doc.skills.map((s) => (s === skill ? { ...s, name, origin: 'user' as const } : s)) };
    }
    case 'education': {
      const entry = doc.education.find((e) => e.factId === answer.entryId);
      if (!entry) throw new CanonicalEditError('NOT_FOUND', 'That entry is not on this draft.');
      if (answer.remove) return { ...doc, education: doc.education.filter((e) => e !== entry) };
      if (isBlank(answer.degree)) refuseBlank('degree');
      if (isBlank(answer.institution)) refuseBlank('school');
      return {
        ...doc,
        education: doc.education.map((e) => (e === entry ? { factId: e.factId, degree: answer.degree.trim(), institution: answer.institution.trim(), start: isoOfZeroDate(answer.start), end: isoOfZeroDate(answer.end) } : e)),
      };
    }
  }
}

/**
 * A typed fix (C-10). Only `surface_backed_skill` applies: the profile backs the skill, so it joins
 * the role the profile shows it in, or the skills list as a line the user chose to add. Nothing
 * invents a bullet or a skill the profile lacks.
 */
export function applySkillFix(doc: CanonicalResumeJson, fix: AtsFix): CanonicalResumeJson {
  const skill = fix.skill;
  if (fix.type !== 'surface_backed_skill' || !fix.insertable || !skill) throw new CanonicalEditError('NOT_FOUND', 'That fix cannot be applied.');
  const role = fix.roleId ? doc.roles.find((r) => r.roleId === fix.roleId) : undefined;
  if (role) return role.skills.includes(skill) ? doc : { ...doc, roles: doc.roles.map((r) => (r === role ? { ...r, skills: [...r.skills, skill] } : r)) };
  if (doc.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase())) return doc;
  return { ...doc, skills: [...doc.skills, { id: idMinter(doc)('fix-k'), name: skill, evidence: [], origin: 'user' }] };
}
