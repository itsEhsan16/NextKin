import { parsePartialDate, type PartialDate } from '@nextkin/engines/dates';
import type { ScoringDocument } from '@nextkin/engines/document';
import type { CanonicalResume } from '@nextkin/engines/facts';

import type { CoverLetterContent, ResumeContent } from '../models/resumeContent';
import type { CanonicalLetterJson, CanonicalResumeJson } from '../schemas/resumeContent';
import type { ContactPresence } from './adapters';

/**
 * The canonical resume JSON (P9-02) mapped to what each consumer reads: the claim ledger
 * (`toEngineResume`), the rubric (`scoringDocumentOf`) and the app's editor model
 * (`toResumeContent`). Phone-safe; the server and the apps map it the same way.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const date = (value: string | null | undefined): PartialDate | null => (value ? parsePartialDate(value) : null);

/** "Mar 2022", "2019" — the printed form of a structured date, without Intl (G12). */
export function printDate(value: string | null | undefined): string {
  const d = date(value);
  if (!d) return '';
  return d.month ? `${MONTHS[d.month - 1]} ${d.year}` : String(d.year);
}

/** "Mar 2022 — Present", derived from the dates; never stored on its own. */
export function printPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const from = printDate(start);
  const to = end === null ? 'Present' : printDate(end);
  return [from, to].filter(Boolean).join(' — ');
}

export function toEngineResume(json: CanonicalResumeJson): CanonicalResume {
  return {
    ...(json.headline ? { headline: json.headline } : {}),
    ...(json.summary ? { summary: json.summary } : {}),
    skills: json.skills.map((s) => ({ ...s, text: s.name })),
    roles: json.roles.map((r) => ({ roleId: r.roleId, company: r.company, title: r.title, start: date(r.start), end: r.end === null ? null : date(r.end), bullets: r.bullets })),
    education: json.education.map((e) => ({ factId: e.factId, institution: e.institution, degree: e.degree })),
    certifications: json.certifications.map((c) => ({ factId: c.factId, name: c.name })),
    projects: json.projects.map((p) => ({ factId: p.factId, name: p.name, bullets: p.bullets })),
  };
}

/** The rubric's view of a canonical resume. Contact is presence only (G5). */
export function scoringDocumentOf(json: CanonicalResumeJson, contact: ContactPresence): ScoringDocument {
  return {
    ...(json.headline ? { headline: json.headline } : {}),
    ...(json.summary ? { summary: json.summary.text } : {}),
    skills: json.skills.map((s) => s.name),
    roles: json.roles.map((r) => {
      const start = date(r.start);
      return {
        id: r.roleId,
        title: r.title,
        company: r.company,
        ...(start ? { start } : {}),
        end: r.end === null ? null : (date(r.end) ?? undefined),
        bullets: r.bullets.map((b) => b.text),
        skills: r.skills,
      };
    }),
    education: json.education.map((e) => ({ institution: e.institution, degree: e.degree })),
    certifications: json.certifications.map((c) => c.name),
    projects: json.projects.map((p) => ({ name: p.name, ...(p.description ? { description: p.description } : {}), bullets: p.bullets.map((b) => b.text) })),
    contact,
  };
}

/** The app's editor model, as the editor and the preview read it. */
export function toResumeContent(json: CanonicalResumeJson, ids: { resumeId: string; versionId: string }): ResumeContent {
  const assumed = (claims: readonly { origin: string }[]) => claims.some((c) => c.origin === 'assumed');
  return {
    kind: 'resume',
    resumeId: ids.resumeId,
    versionId: ids.versionId,
    ...(json.header ? { header: { name: json.header.name, items: json.header.items.map((i) => ({ text: i.text, ...(i.url ? { url: i.url } : {}) })) } } : {}),
    ...(json.headline ? { headline: json.headline } : {}),
    summary: json.summary?.text ?? '',
    skills: json.skills.map((s) => s.name),
    experience: json.roles.map((r) => ({
      id: r.roleId,
      roleId: r.roleId,
      company: r.company,
      title: r.title,
      period: printPeriod(r.start, r.end),
      ...(r.start ? { start: r.start } : {}),
      end: r.end,
      ...(r.location ? { location: r.location } : {}),
      skills: [...r.skills],
      bullets: r.bullets.map((b) => b.text),
      ...(r.assumed || assumed(r.bullets) ? { needsReview: true } : {}),
    })),
    projects: json.projects.map((p) => ({ id: p.factId, name: p.name, description: p.description ?? '', bullets: p.bullets.map((b) => b.text), ...(assumed(p.bullets) ? { needsReview: true } : {}) })),
    certifications: json.certifications.map((c) => c.name),
    education: json.education.map((e) => ({ id: e.factId, institution: e.institution, degree: [e.degree, e.field].filter(Boolean).join(' '), period: printPeriod(e.start, e.end), ...(e.assumed ? { needsReview: true } : {}) })),
    ...(json.review
      ? {
          review: {
            total: json.review.total,
            roles: json.review.roles,
            education: json.review.education,
            skills: [...json.review.skills],
            pendingSkills: json.skills.filter((s) => s.origin === 'assumed').map((s) => s.name),
            removedSkills: [...json.review.removedSkills],
          },
        }
      : {}),
  };
}

/** A letter version as the editor reads it; `resumeId` is the resume it was written from (§7.10). */
export function toLetterContent(json: CanonicalLetterJson, ids: { resumeId: string; versionId: string }): CoverLetterContent {
  return {
    kind: 'cover_letter',
    resumeId: ids.resumeId,
    versionId: ids.versionId,
    tone: json.tone,
    greeting: json.greeting,
    paragraphs: json.paragraphs.map((p) => p.text),
    signoff: json.signoff,
    ...(json.assumed ? { needsReview: true } : {}),
  };
}
