import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * How many pages a resume should fit on (toreview §111.1, owner 2026-10-19: "For fresher one page
 * is perfect, while experienced resume can go above one"). Under five years of dated experience
 * the target is one page; from five years it is the original's page count when known, at most two.
 * Pure: the month it is counted at is passed in. The basis travels with the number (G17).
 */

export const EXPERIENCED_MONTHS = 60;
export const MAX_PAGES = 2;

export interface PageBudget {
  pages: 1 | 2;
  /** Months of dated experience, overlaps counted once. */
  months: number;
  basis: string;
}

const monthIndex = (ym: string | null | undefined): number | null => {
  const m = ym ? /^(\d{4})(?:-(\d{2}))?$/.exec(ym) : null;
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
};

/** Months covered by the roles' dated spans, each month counted once however many roles hold it. */
export function experienceMonths(doc: Pick<CanonicalResumeJson, 'roles'>, asOf: { year: number; month: number }): number {
  const now = asOf.year * 12 + asOf.month - 1;
  const spans = doc.roles
    .map((r) => [monthIndex(r.start), r.end === null ? now : monthIndex(r.end)] as const)
    .filter((s): s is readonly [number, number] => s[0] !== null && s[1] !== null && s[1] >= s[0])
    .map(([a, b]) => [a, Math.min(b, now)] as const)
    .sort((x, y) => x[0] - y[0]);
  let months = 0;
  let reach = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, reach + 1);
    if (end >= from) months += end - from + 1;
    reach = Math.max(reach, end);
  }
  return months;
}

export function pageBudget(doc: Pick<CanonicalResumeJson, 'roles'>, asOf: { year: number; month: number }, sourcePages?: number | null): PageBudget {
  const months = experienceMonths(doc, asOf);
  const years = Math.floor(months / 12);
  if (months < EXPERIENCED_MONTHS) return { pages: 1, months, basis: `Fitted to 1 page: under 5 years of experience (${years === 0 ? 'under a year' : `${years} year${years === 1 ? '' : 's'}`})` };
  const pages = sourcePages && sourcePages >= 1 ? (Math.min(sourcePages, MAX_PAGES) as 1 | 2) : MAX_PAGES;
  return { pages, months, basis: sourcePages ? `Kept to ${pages} page${pages === 1 ? '' : 's'}, as the original: ${years} years of experience` : `Up to ${MAX_PAGES} pages: ${years} years of experience` };
}
