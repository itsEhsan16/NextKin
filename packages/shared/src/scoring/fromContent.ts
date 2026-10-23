import type { PartialDate } from '@nextkin/engines/dates';

import type { ContentRole, CoverLetterContent, ResumeContent } from '../models/resumeContent';
import {
  CANONICAL_SCHEMA_VERSION,
  type CanonicalClaim,
  type CanonicalLetterJson,
  type CanonicalResumeJson,
} from '../schemas/resumeContent';
import { parsePeriod, roleDates } from './adapters';

/**
 * The editor model mapped back to the canonical JSON the server stores: for documents that were
 * written as editor content (the demo personas' seeded resumes, toreview §109), never for a
 * generated version, which is canonical from the start.
 *
 * Every line is the user's own (`origin: 'user'`, no evidence): nothing here cites a profile fact
 * it was not generated from. A Zero Resume entry still waiting for review stays `assumed`.
 */

const iso = (d: PartialDate | null | undefined): string | null =>
  d ? (d.month ? `${d.year}-${String(d.month).padStart(2, '0')}` : String(d.year)) : null;

const clip = (text: string, max: number) => text.trim().slice(0, max);

const claims = (
  prefix: string,
  lines: readonly string[],
  origin: CanonicalClaim['origin'],
  max: number,
) =>
  lines
    .map((line) => clip(line, 600))
    .filter(Boolean)
    .slice(0, max)
    .map((text, i): CanonicalClaim => ({
      id: `${prefix}-${i}`.slice(0, 64),
      text,
      evidence: [],
      origin,
    }));

/** A role's dates; an unknown end is the start (a point in time), never "present". */
function datesOf(role: Pick<ContentRole, 'start' | 'end' | 'period'>) {
  const { start, end } = roleDates(role);
  const from = iso(start);
  return { start: from, end: end === null ? null : (iso(end) ?? from) };
}

export function canonicalFromContent(
  content: ResumeContent,
  options: { roleId?: (role: ContentRole, index: number) => string } = {},
): CanonicalResumeJson {
  const skillNames = [...new Set(content.skills.map((s) => clip(s, 120)).filter(Boolean))];
  const summary = clip(content.summary, 600);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    ...(content.headline?.trim() ? { headline: clip(content.headline, 200) } : {}),
    ...(summary
      ? { summary: { id: 'summary', text: summary, evidence: [], origin: 'user' as const } }
      : {}),
    skills: skillNames
      .slice(0, 60)
      .map((name, i) => ({ name, id: `skill-${i}`, evidence: [], origin: 'user' as const })),
    roles: content.experience.slice(0, 20).map((role, i) => {
      const roleId = (options.roleId?.(role, i) ?? role.roleId ?? role.id).slice(0, 80);
      return {
        roleId,
        company: clip(role.company, 200) || 'Company',
        title: clip(role.title, 200) || 'Role',
        ...datesOf(role),
        ...(role.location?.trim() ? { location: clip(role.location, 200) } : {}),
        skills: [...new Set((role.skills ?? []).map((s) => clip(s, 120)).filter(Boolean))].slice(
          0,
          40,
        ),
        bullets: claims(`r${i}-b`, role.bullets, role.needsReview ? 'assumed' : 'user', 12),
        ...(role.needsReview ? { assumed: true as const } : {}),
      };
    }),
    education: content.education.slice(0, 10).map((e, i) => {
      const { start, end } = parsePeriod(e.period);
      return {
        factId: (e.id || `edu-${i}`).slice(0, 80),
        institution: clip(e.institution, 200) || 'Institution',
        degree: clip(e.degree, 200) || 'Degree',
        ...(start ? { start: iso(start) } : {}),
        ...(end !== undefined ? { end: end === null ? null : iso(end) } : {}),
        ...(e.needsReview ? { assumed: true as const } : {}),
      };
    }),
    certifications: content.certifications
      .map((name) => clip(name, 200))
      .filter(Boolean)
      .slice(0, 20)
      .map((name, i) => ({ factId: `cert-${i}`, name })),
    projects: content.projects.slice(0, 10).map((p, i) => ({
      factId: (p.id || `project-${i}`).slice(0, 80),
      name: clip(p.name, 200) || 'Project',
      ...(p.description.trim() ? { description: clip(p.description, 1000) } : {}),
      bullets: claims(`p${i}-b`, p.bullets, p.needsReview ? 'assumed' : 'user', 8),
    })),
    ...(content.review
      ? {
          review: {
            total: content.review.total,
            roles: content.review.roles,
            education: content.review.education,
            skills: content.review.skills.slice(0, 60),
            removedSkills: content.review.removedSkills.slice(0, 60),
          },
        }
      : {}),
  };
}

export function canonicalLetterFromContent(content: CoverLetterContent): CanonicalLetterJson {
  return {
    kind: 'cover_letter',
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    tone: content.tone,
    greeting: clip(content.greeting, 200),
    paragraphs: claims('p', content.paragraphs, content.needsReview ? 'assumed' : 'user', 8),
    signoff: clip(content.signoff, 200),
    ...(content.needsReview ? { assumed: true as const } : {}),
  };
}
