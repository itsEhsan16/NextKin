import { parsePartialDate, type PartialDate } from '@nextkin/engines/dates';
import type { FormatFacts, ScoringDocument } from '@nextkin/engines/document';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { requirementsFromJd, type JdLists, type Requirement } from '@nextkin/engines/requirements';

import { statedOf } from '../jobs/jdRequirements';
import type { JdDraft, JdRequirement } from '../models/jd';
import type { Profile } from '../models/profile';
import type { ContentRole, ResumeContent } from '../models/resumeContent';

/**
 * From the app's models to what `packages/engines` reads (C-10). Phone-safe and pure, so the mock
 * and (from P9) the server turn the same document into the same engine input.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  januar: 1, februar: 2, märz: 3, mai: 5, juni: 6, juli: 7, okt: 10, dez: 12,
};
const PRESENT = new Set(['present', 'current', 'now', 'today', 'heute', 'aktuell']);

/** One side of a printed period: "Mar 2022", "03/2022", "2019", "Present". */
function readSide(text: string): PartialDate | null | undefined {
  const side = text.trim().toLowerCase();
  if (!side) return undefined;
  if (PRESENT.has(side)) return null;
  const words = /^([a-zä]+)\.?\s+(\d{4})$/.exec(side);
  if (words && MONTHS[words[1]!] !== undefined) return { year: Number(words[2]), month: MONTHS[words[1]!] };
  const slash = /^(\d{1,2})[/.](\d{4})$/.exec(side);
  if (slash && Number(slash[1]) >= 1 && Number(slash[1]) <= 12) return { year: Number(slash[2]), month: Number(slash[1]) };
  if (/^\d{4}$/.test(side)) return { year: Number(side) };
  return undefined;
}

/** "Mar 2022 — Present" → start and end. Unreadable sides stay undefined, never guessed. */
export function parsePeriod(period: string): { start?: PartialDate; end?: PartialDate | null } {
  // "2019-2021" has no spaces around its hyphen; every other form separates the sides with a dash
  // (or "to"/"bis") that has space on both sides, or with an em or en dash.
  const compact = /^(\d{4})-(\d{4})$/.exec(period.trim());
  const [from = '', to = ''] = compact ? [compact[1]!, compact[2]!] : period.split(/\s+(?:—|–|-|to|bis)\s+|\s*[—–]\s*/);
  const start = readSide(from);
  const end = readSide(to);
  return { ...(start ? { start } : {}), ...(end !== undefined ? { end } : {}) };
}

/** A role's structured dates (C-10), falling back to reading its printed period. */
export function roleDates(role: Pick<ContentRole, 'start' | 'end' | 'period'>): { start?: PartialDate; end?: PartialDate | null } {
  if (role.start !== undefined) {
    const start = parsePartialDate(role.start) ?? undefined;
    const end = role.end === null ? null : (parsePartialDate(role.end) ?? undefined);
    return { ...(start ? { start } : {}), ...(end !== undefined ? { end } : {}) };
  }
  return parsePeriod(role.period);
}

/** Which contact details a document carries: three booleans, never the values (G5). */
export type ContactPresence = { email: boolean; phone: boolean; location: boolean };

/**
 * A resume body as the scorer reads it. Roles take their profile id when they have one, so a fix
 * that cites a profile role lands on the document role made from it. Contact falls back to what
 * the profile adds at render time (G5: contact details are merged in when the file is made).
 */
export function documentFromContent(content: ResumeContent, contactFallback?: ContactPresence): ScoringDocument {
  const contact = content.contact
    ? { email: Boolean(content.contact.email), phone: Boolean(content.contact.phone), location: Boolean(content.contact.location) }
    : (contactFallback ?? { email: false, phone: false, location: false });
  return {
    ...(content.headline ? { headline: content.headline } : {}),
    summary: content.summary,
    skills: content.skills,
    roles: content.experience.map((role) => ({
      id: role.roleId ?? role.id,
      title: role.title,
      company: role.company,
      ...roleDates(role),
      bullets: role.bullets,
      ...(role.skills ? { skills: role.skills } : {}),
    })),
    education: content.education.map((entry) => ({ institution: entry.institution, degree: entry.degree })),
    certifications: content.certifications,
    projects: content.projects.map((project) => ({ name: project.name, description: project.description, bullets: project.bullets })),
    contact,
    ...(content.links ? { links: content.links } : {}),
  };
}

/** The profile as the yardstick a generated resume is measured against (G16). */
export function documentFromProfile(profile: Profile, hasEmail = true): ScoringDocument {
  return {
    ...(profile.headline ? { headline: profile.headline } : {}),
    ...(profile.bio ? { summary: profile.bio } : {}),
    skills: profile.skills,
    roles: profile.experiences.map((exp) => {
      const start = parsePartialDate(exp.startDate) ?? undefined;
      const end = exp.current ? null : (parsePartialDate(exp.endDate) ?? undefined);
      return {
        id: exp.id,
        title: exp.title,
        company: exp.company,
        ...(start ? { start } : {}),
        ...(end !== undefined ? { end } : {}),
        bullets: exp.summary ? [exp.summary] : [],
        skills: exp.skills,
      };
    }),
    education: profile.education.map((entry) => ({ institution: entry.institution, degree: entry.degree })),
    certifications: profile.certifications.map((c) => c.name),
    contact: { email: hasEmail, phone: Boolean(profile.phone), location: Boolean(profile.location) },
  };
}

/** What a profile adds to a printed resume's contact line. */
export const profileContact = (profile: Profile, hasEmail = true): ContactPresence => ({
  email: hasEmail,
  phone: Boolean(profile.phone),
  location: Boolean(profile.location),
});

/** The JD's lists as the engines take them. */
export const jdLists = (
  draft: Pick<JdDraft, 'requiredSkills' | 'preferredSkills' | 'tools' | 'rawText'> & Partial<Pick<JdDraft, 'structured'>>,
): JdLists => ({
  requiredSkills: draft.requiredSkills,
  preferredSkills: draft.preferredSkills,
  tools: draft.tools,
  rawText: draft.rawText,
  // The structured reading's years and conditions, so the ledger reports what the page shows.
  ...(draft.structured ? { stated: statedOf(draft.structured) } : {}),
});

export const requirementsOf = (lists: JdLists): Requirement[] => requirementsFromJd(lists, TAXONOMY);

/** Typed requirements in the model's shape, for `JdDraft.requirements`. */
export function typedRequirements(lists: JdLists): JdRequirement[] {
  return requirementsOf(lists).map((req) => ({
    id: req.id,
    text: req.text,
    importance: req.importance,
    kind: req.kind,
    ...(req.minYears !== undefined ? { minYears: req.minYears } : {}),
    ...(req.span ? { span: req.span } : {}),
  }));
}

/**
 * The layout facts of a NextKin document. Every resume template is built to them (toreview §130):
 * one column of real text, standard headings, no tables or images, a standard font (Lato, Roboto or
 * Times New Roman metrics) in two faces, contact in the body. The server's tests hold every
 * template to this, and each downloaded PDF is read back like an upload and records whether it
 * holds (`export_events.ats_safe`). The mock's documents are scored as the same templates.
 */
export const PARSE_SAFE_TEMPLATE: FormatFacts = {
  singleColumn: true,
  standardHeadings: true,
  noTablesOrImages: true,
  standardFonts: true,
  contactInBody: true,
};

/** "Present" for the engines, from a date the caller chooses (the engines never read the clock). */
export const asOfDate = (date: Date): PartialDate => ({ year: date.getFullYear(), month: date.getMonth() + 1 });
