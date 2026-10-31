import type { Certification, Education, Experience, LinkKind, ProfileLink } from '@/data/models';
import { formatMonthYear } from '@/lib';
import type { LineIconName } from '@/ui/Icon';

/**
 * NextKin V2 §7.3 — the row copy behind the four career-profile lists (experience, education,
 * certifications, links). No React and no theme in here: what a row *says* is a rule about the
 * data, so it is unit tested without rendering a page. Same split as
 * `resumes/sectionEdits.ts` and `create/jdSkillEdits.ts`.
 */

/**
 * What leads an entry card (PROFILE 04 573:42, PROFILE 12 577:9046): the company's or school's
 * initial, a link kind's glyph, or — for LinkedIn alone — the illustrated mark the boards draw.
 */
export type EntryTileSpec =
  { kind: 'letter'; name: string } | { kind: 'glyph'; icon: LineIconName } | { kind: 'linkedin' };

/**
 * One card on a profile list (PROFILE 04 / 07 / 12): a title over who and when, an optional status
 * pill, and the tags a list of entries is actually scanned for.
 */
export type EntryRow = {
  id: string;
  tile: EntryTileSpec;
  title: string;
  /** The company, school or issuer — or a link's tidied address. */
  subtitle?: string;
  /** The dates, a step quieter. */
  meta?: string;
  pill?: { label: string; tone: 'success' | 'danger' };
  tags?: string[];
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

/** Drops an empty string to `undefined`, so a card draws no blank line for a missing fact. */
const present = (value: string | undefined): string | undefined =>
  value && value.length > 0 ? value : undefined;

/**
 * Newest first, as the list headings promise (573:40): what you are still doing leads, then the
 * rest by start month. Ties keep the order they were saved in.
 */
export function newestFirst<T extends { startDate: string; current: boolean }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return b.startDate.localeCompare(a.startDate);
  });
}

const CURRENT = 'Current';

/**
 * "Senior UX Designer" over "Flipkart" over "Mar 2022 – Present", a Current pill on the role you
 * hold now, and the skills claimed for that role (573:47).
 *
 * The tags are not decoration. V2 §7.3 makes per-role skill tags load-bearing — they are what the
 * Timeline Validation Engine (§7.7) checks a generated resume against — and until now the profile
 * had nowhere that showed them, so the one field a user most needs to check was invisible outside
 * the edit form.
 */
export function experienceRow(entry: Experience): EntryRow {
  const dates = formatEntryDates(entry.startDate, entry.endDate, entry.current);
  return {
    id: entry.id,
    tile: { kind: 'letter', name: entry.company },
    title: entry.title,
    ...(present(entry.company) ? { subtitle: entry.company } : {}),
    ...(dates ? { meta: dates } : {}),
    ...(entry.current ? { pill: { label: CURRENT, tone: 'success' as const } } : {}),
    ...(entry.skills.length > 0 ? { tags: [...entry.skills] } : {}),
  };
}

/** "M.Des." over "National Institute of Design" over its dates, with the field of study (577:6901). */
export function educationRow(entry: Education): EntryRow {
  const dates = formatEntryDates(entry.startDate, entry.endDate, entry.current);
  return {
    id: entry.id,
    tile: { kind: 'letter', name: entry.institution },
    title: entry.degree,
    ...(present(entry.institution) ? { subtitle: entry.institution } : {}),
    ...(dates ? { meta: dates } : {}),
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
 * "AWS Solutions Architect" over "Amazon" over "Issued 2021", with an Expired pill once the
 * credential has lapsed. A lapsed credential is still shown — hiding it would lose the user's
 * record of it — but the card never lets it read as current. No board draws a filled list (PROFILE
 * 10 is the empty state); it is the role card's shape, given a credential's facts.
 */
export function certificationRow(entry: Certification, now: Date = new Date()): EntryRow {
  const year = issuedYear(entry.issuedOn);
  return {
    id: entry.id,
    tile: { kind: 'letter', name: entry.issuer || entry.name },
    title: entry.name,
    ...(present(entry.issuer) ? { subtitle: entry.issuer } : {}),
    ...(year ? { meta: `Issued ${year}` } : {}),
    ...(certificationExpired(entry, now)
      ? { pill: { label: EXPIRED, tone: 'danger' as const } }
      : {}),
  };
}

/**
 * Glyphs for the link kinds, as the link-kind sheet draws them (PROFILE 14 577:9800). LinkedIn has
 * an illustrated mark of its own on the boards, so its glyph is only the fallback a plain row uses.
 * The line set has no brand marks.
 */
export const LINK_KIND_ICON: Record<LinkKind, LineIconName> = {
  portfolio: 'Palette',
  linkedin: 'Passport',
  github: 'GitBranch01',
  website: 'Globe02',
  other: 'Link01',
};

/** The link's own glyph; a link saved before the kind existed falls back to the chain. */
export const linkIcon = (kind: LinkKind | undefined): LineIconName =>
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

/** A link's tile: LinkedIn's own mark, or its kind's glyph on the brand tint. */
export function linkTile(kind: LinkKind | undefined): EntryTileSpec {
  return kind === 'linkedin' ? { kind: 'linkedin' } : { kind: 'glyph', icon: linkIcon(kind) };
}

/** "Portfolio" over "georgesmith.design" (577:9050). */
export function linkRow(entry: ProfileLink): EntryRow {
  return {
    id: entry.id,
    tile: linkTile(entry.kind),
    title: entry.label,
    subtitle: tidyUrl(entry.url),
  };
}
