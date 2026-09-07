import type { Certification, Education, Experience, LinkKind, ProfileLink } from '@/data/models';
import { formatMonthYear } from '@/lib';

/**
 * NextKin V2 §7.3 — the row copy behind the four career-profile lists (experience, education,
 * certifications, links). No React and no theme in here: what a row *says* is a rule about the
 * data, so it is unit tested without rendering a page. Same split as
 * `resumes/sectionEdits.ts` and `create/jdSkillEdits.ts`.
 */

/**
 * A title on its own line, a muted meta line under it, and optionally a line of tags.
 *
 * It was `{ label, value }` until a device pass found the rows empty: `value` is `ListRow`'s
 * *trailing* value, and a 49-character subtitle handed to it starved the label to width 0, so
 * "M.Des." rendered no glyphs at all. The doc comments here always said "X over Y" — the copy was
 * written for a two-line row that had not been built. It has now (`@/ui/EntryRow`).
 */
export type EntryRow = {
  id: string;
  /** FontAwesome 5 Free Solid glyph name. */
  icon: string;
  title: string;
  meta?: string;
  /** A third line — the facts a list of entries is actually scanned for. */
  tags?: string[];
};

/** " · " joins the parts of a row's meta line, skipping the ones that are missing. */
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

/**
 * "Senior UX Designer" over "Flipkart · Mar 2022 – Present", over the skills claimed for that role.
 *
 * The tags are not decoration. V2 §7.3 makes per-role skill tags load-bearing — they are what the
 * Timeline Validation Engine (§7.7) checks a generated resume against — and until now the profile
 * had nowhere that showed them, so the one field a user most needs to check was invisible outside
 * the edit form.
 */
export function experienceRow(entry: Experience): EntryRow {
  return {
    id: entry.id,
    icon: 'briefcase',
    title: entry.title,
    meta: meta([entry.company, formatEntryDates(entry.startDate, entry.endDate, entry.current)]),
    ...(entry.skills.length > 0 ? { tags: [...entry.skills] } : {}),
  };
}

/** "M.Des." over "National Institute of Design · Jul 2014 – May 2016", over the field of study. */
export function educationRow(entry: Education): EntryRow {
  return {
    id: entry.id,
    icon: 'graduation-cap',
    title: entry.degree,
    meta: meta([
      entry.institution,
      formatEntryDates(entry.startDate, entry.endDate, entry.current),
    ]),
    ...(entry.field ? { tags: [entry.field] } : {}),
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
    title: entry.name,
    meta: meta([
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
    title: entry.label,
    meta: tidyUrl(entry.url),
  };
}
