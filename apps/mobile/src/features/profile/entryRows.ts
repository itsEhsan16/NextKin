import type { Certification, Education, Experience, LinkKind, ProfileLink } from '@/data/models';
import { formatMonthYear } from '@/lib';

/**
 * NextKin V2 §7.3 — the row copy behind the four career-profile lists (experience, education,
 * certifications, links). No React and no theme in here: what a row *says* is a rule about the
 * data, so it is unit tested without rendering a page. Same split as
 * `resumes/sectionEdits.ts` and `create/jdSkillEdits.ts`.
 */

export type EntryRow = {
  id: string;
  /** FontAwesome 5 Free Solid glyph name. */
  icon: string;
  label: string;
  value?: string;
};

/** " · " joins the parts of a row's value, skipping the ones that are missing. */
const meta = (parts: readonly (string | undefined)[]): string | undefined => {
  const kept = parts.filter((part): part is string => !!part && part.length > 0);
  return kept.length > 0 ? kept.join(' · ') : undefined;
};

const PRESENT = 'Present';

/**
 * "Mar 2022 – Present", "Jun 2019 – Feb 2022". A role still held reads as Present rather than
 * being left open-ended; a date the picker never wrote drops out instead of printing "Invalid".
 */
export function formatEntryDates(
  startDate: string,
  endDate: string | undefined,
  current: boolean,
): string | undefined {
  const start = formatMonthYear(startDate);
  const end = current ? PRESENT : endDate ? formatMonthYear(endDate) : undefined;
  if (!start) return end;
  return end ? `${start} – ${end}` : start;
}

/** "Senior UX Designer" over "Flipkart · Mar 2022 – Present". */
export function experienceRow(entry: Experience): EntryRow {
  return {
    id: entry.id,
    icon: 'briefcase',
    label: entry.title,
    value: meta([entry.company, formatEntryDates(entry.startDate, entry.endDate, entry.current)]),
  };
}

/** "M.Des." over "National Institute of Design · Jul 2014 – May 2016". */
export function educationRow(entry: Education): EntryRow {
  return {
    id: entry.id,
    icon: 'graduation-cap',
    label: entry.degree,
    value: meta([
      entry.institution,
      formatEntryDates(entry.startDate, entry.endDate, entry.current),
    ]),
  };
}

const EXPIRED = 'Expired';

/** The issued year, or nothing when the date is missing or unparseable. */
function issuedYear(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  // UTC for the same reason `formatMonthYear` uses it: the picker writes date-only strings,
  // which parse as UTC midnight and would slip a year west of Greenwich on 1 January.
  return Number.isNaN(date.getTime()) ? undefined : String(date.getUTCFullYear());
}

/** A credential is expired once `expiresOn` is in the past — never on the day it lapses. */
export function certificationExpired(entry: Certification, now: Date = new Date()): boolean {
  if (!entry.expiresOn) return false;
  const expires = new Date(entry.expiresOn);
  return !Number.isNaN(expires.getTime()) && expires.getTime() < now.getTime();
}

/**
 * "AWS Solutions Architect" over "Amazon · 2021", with " · Expired" appended once the
 * credential has lapsed. A lapsed credential is still shown — hiding it would lose the user's
 * record of it — but the row never lets it read as current.
 */
export function certificationRow(entry: Certification, now: Date = new Date()): EntryRow {
  return {
    id: entry.id,
    icon: 'certificate',
    label: entry.name,
    value: meta([
      entry.issuer,
      issuedYear(entry.issuedOn),
      certificationExpired(entry, now) ? EXPIRED : undefined,
    ]),
  };
}

/**
 * Glyphs for the link kinds. FontAwesome's LinkedIn and GitHub marks live in the Brands set,
 * which `ListRow` does not draw, so each kind gets a Solid glyph that reads as its category.
 */
export const LINK_KIND_ICON: Record<LinkKind, string> = {
  portfolio: 'palette',
  linkedin: 'id-badge',
  github: 'code',
  website: 'globe',
  other: 'link',
};

/** The link's own glyph; a link saved before the kind existed falls back to the chain. */
export const linkIcon = (kind: LinkKind | undefined): string =>
  kind ? LINK_KIND_ICON[kind] : LINK_KIND_ICON.other;

/**
 * "https://www.linkedin.com/in/george-smith" → "linkedin.com/in/george-smith". The scheme and
 * the "www." carry no meaning for the reader; everything after them says where the link goes,
 * so it stays.
 */
export function tidyUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/** "Portfolio" over "georgesmith.design". */
export function linkRow(entry: ProfileLink): EntryRow {
  return {
    id: entry.id,
    icon: linkIcon(entry.kind),
    label: entry.label,
    value: tidyUrl(entry.url),
  };
}
