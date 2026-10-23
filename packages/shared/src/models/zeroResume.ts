import type { Resume } from './resume';
import type { ContentEducation, ContentRole, ResumeContent } from './resumeContent';

/**
 * Zero Resume Mode (V2 §7.9, toreview §72): a first resume from a name, a years band and the role
 * you want. The draft marks every guess; these are the shapes and the pure rules that turn a draft
 * into ZERO 03's checklist, ZERO 04's next question and ZERO 05's summary, so every screen reads
 * the same count.
 */

/** ZERO 01's answers to "Years of work experience" (613:259). */
export type ZeroYears = 'none' | '1-2' | '3-5' | '6-10' | '10+';

export const ZERO_YEARS: readonly ZeroYears[] = ['none', '1-2', '3-5', '6-10', '10+'];

export const ZERO_YEARS_LABEL: Record<ZeroYears, string> = {
  none: 'None',
  '1-2': '1–2',
  '3-5': '3–5',
  '6-10': '6–10',
  '10+': '10+',
};

/** V2 §7.9 asks for a number of years; each band's figure is what the seed and profile carry. */
export const ZERO_YEARS_VALUE: Record<ZeroYears, number> = {
  none: 0,
  '1-2': 2,
  '3-5': 4,
  '6-10': 8,
  '10+': 12,
};

/** Zero Resume Mode's seed (V2 §7.9) — there is no resume to start from. */
export type ZeroSeed = {
  fullName: string;
  yearsExperience: number;
  /** The band ZERO 01 offers; `yearsExperience` is its figure. */
  yearsBand?: ZeroYears;
  targetTitle?: string;
  location?: string;
};

/**
 * What a draft assumed, written with it (V2 §7.9 flags each role, date range, skill claim and
 * education entry). The roles and education carry their own flags; skills are plain strings, so
 * the claims still waiting for an answer are listed here.
 */
export type ZeroReview = {
  /** Things to check when the draft was written: ZERO 03's "Check 9 things". */
  total: number;
  roles: number;
  /** Every skill claim the draft made. */
  skills: string[];
  /** Skill claims still waiting for a yes or a no. */
  pendingSkills: string[];
  /** Skill claims the user said no to, for ZERO 05's summary. */
  removedSkills: string[];
  education: number;
};

/** A bracketed blank ("[Company Name]", "[Degree]") or nothing at all. */
export const isBlank = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed.length === 0 || /^\[.*\]$/.test(trimmed);
};

/** A role is checked once, with its company: it waits while flagged or while its company is blank. */
const roleWaits = (role: ContentRole): boolean =>
  role.needsReview === true || isBlank(role.company);

const entryWaits = (entry: ContentEducation): boolean =>
  entry.needsReview === true || isBlank(entry.institution) || isBlank(entry.degree);

/** How many of the draft's guesses are still open, by kind. */
export function zeroPending(content: ResumeContent) {
  return {
    roles: content.experience.filter((role) => role.needsReview === true).length,
    companies: content.experience.filter((role) => isBlank(role.company)).length,
    skills: content.review?.pendingSkills ?? [],
    education: content.education.filter(entryWaits).length,
  };
}

/**
 * "Checked 3 of 9". Deleting a guess resolves it as surely as confirming it (§7.9's three
 * resolutions), so the total stays what the draft asked for and the count only climbs.
 */
export function zeroProgress(content: ResumeContent): {
  checked: number;
  total: number;
  left: number;
} {
  const pending = zeroPending(content);
  const left = pending.roles + pending.companies + pending.skills.length + pending.education;
  const total = content.review?.total ?? 0;
  return { checked: Math.max(0, total - left), total, left };
}

export type ZeroCheckGroup = 'roles' | 'companies' | 'skills' | 'education';

/** One row of ZERO 03's list (613:427). */
export type ZeroCheckRow = { group: ZeroCheckGroup; title: string; detail: string; done: boolean };

const blanks = (count: number) => `${count} ${count === 1 ? 'blank' : 'blanks'}`;

/**
 * ZERO 03's four rows: what kind of guess, how many are left, and why. A kind the draft never
 * guessed (no roles for someone starting out) is left out; a kind that is done says so.
 */
export function zeroCheckRows(content: ResumeContent): ZeroCheckRow[] {
  const review = content.review;
  if (!review) return [];
  const pending = zeroPending(content);
  const row = (
    group: ZeroCheckGroup,
    label: string,
    left: number,
    count: string,
    detail: string,
  ): ZeroCheckRow =>
    left > 0
      ? { group, title: `${label} · ${count}`, detail, done: false }
      : { group, title: label, detail: 'Checked', done: true };

  const rows: ZeroCheckRow[] = [];
  if (review.roles > 0) {
    rows.push(
      row(
        'roles',
        'Roles and dates',
        pending.roles,
        String(pending.roles),
        'The titles and years are our guesses',
      ),
      row(
        'companies',
        'Company names',
        pending.companies,
        blanks(pending.companies),
        'Only you know these',
      ),
    );
  }
  if (review.skills.length > 0) {
    rows.push(
      row(
        'skills',
        'Skills',
        pending.skills.length,
        String(pending.skills.length),
        'Confirm you really have them',
      ),
    );
  }
  if (review.education > 0) {
    rows.push(
      row(
        'education',
        'Education',
        pending.education,
        blanks(pending.education),
        'Your degree and where you studied',
      ),
    );
  }
  return rows;
}

/** ZERO 04's next question, in the list's order: each role, then each skill, then education. */
export type ZeroCheckItem =
  | { kind: 'role'; role: ContentRole }
  | { kind: 'skill'; skill: string }
  | { kind: 'education'; entry: ContentEducation };

export const ZERO_CHECK_GROUP_LABEL: Record<ZeroCheckItem['kind'], string> = {
  role: 'Roles and dates',
  skill: 'Skills',
  education: 'Education',
};

export function nextZeroCheck(content: ResumeContent): ZeroCheckItem | undefined {
  const role = content.experience.find(roleWaits);
  if (role) return { kind: 'role', role };
  const skill = content.review?.pendingSkills[0];
  if (skill) return { kind: 'skill', skill };
  const entry = content.education.find(entryWaits);
  if (entry) return { kind: 'education', entry };
  return undefined;
}

const count = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

/**
 * ZERO 05's "What you checked" (613:679): one line per kind, read off what the draft guessed and
 * what is in the document now. Deletions are said too, so the summary never claims more than
 * the user confirmed.
 */
export function zeroSummary(content: ResumeContent): string[] {
  const review = content.review;
  if (!review) return [];
  const lines: string[] = [];

  if (review.roles > 0) {
    const kept = content.experience.length;
    const removed = Math.max(0, review.roles - kept);
    if (kept > 0) {
      lines.push(`${count(kept, 'role')}: titles and dates confirmed`);
      lines.push(`${count(kept, 'company name')} filled in`);
    }
    if (removed > 0) lines.push(`${count(removed, 'role')} removed`);
  }

  if (review.skills.length > 0) {
    const removed = review.removedSkills.length;
    const kept = review.skills.length - removed - review.pendingSkills.length;
    if (kept > 0) lines.push(`${count(kept, 'skill')} confirmed`);
    if (removed > 0) lines.push(`${count(removed, 'skill')} removed`);
  }

  if (review.education > 0) {
    lines.push(content.education.length > 0 ? 'Education filled in' : 'Education removed');
  }
  return lines;
}

/* ------------------------------------------------------------------ dates */

/** A date the draft guessed or the user picked; no month means a year-only guess ("2021"). */
export type ZeroDate = { year: number; month?: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PRESENT = 'Present';

export function formatZeroDate(date: ZeroDate): string {
  const month = date.month != null ? MONTHS[date.month - 1] : undefined;
  return month ? `${month} ${date.year}` : String(date.year);
}

/** "2021 — Present", "Mar 2017 — Jun 2021": the span a printed resume shows (V2 §7.11). */
export function formatZeroPeriod(start: ZeroDate, end: ZeroDate | 'present'): string {
  return `${formatZeroDate(start)} — ${end === 'present' ? PRESENT : formatZeroDate(end)}`;
}

const DATE = /^(?:([A-Z][a-z]{2}) )?(\d{4})$/;

function parseZeroDate(text: string): ZeroDate | null {
  const match = DATE.exec(text.trim());
  if (!match) return null;
  const [, month, year] = match;
  const index = month ? MONTHS.indexOf(month) : -1;
  if (month && index < 0) return null;
  return index >= 0 ? { year: Number(year), month: index + 1 } : { year: Number(year) };
}

/** Reads a span back for the check sheet's From and To. Unreadable text gives null. */
export function parseZeroPeriod(
  period: string,
): { start: ZeroDate; end: ZeroDate | 'present' } | null {
  const [from, to] = period.split(/\s+[—–-]\s+/);
  if (!from || !to) return null;
  const start = parseZeroDate(from);
  const end = to.trim() === PRESENT ? 'present' : parseZeroDate(to);
  return start && end ? { start, end } : null;
}

/** An ISO day for the profile, pinned to the first of its month (January for a year guess). */
export const zeroDateIso = (date: ZeroDate): string =>
  `${date.year}-${String(date.month ?? 1).padStart(2, '0')}-01`;

/* ------------------------------------------------------------- resolving */

/**
 * One answer from ZERO 04 (V2 §7.9's three resolutions): save the guess as the real fact — which
 * confirms it when nothing changed — or delete it.
 */
export type ZeroResolution =
  | {
      kind: 'role';
      roleId: string;
      remove?: false;
      title: string;
      company: string;
      start: ZeroDate;
      end: ZeroDate | 'present';
    }
  | { kind: 'role'; roleId: string; remove: true }
  | { kind: 'skill'; skill: string; remove?: false; name: string }
  | { kind: 'skill'; skill: string; remove: true }
  | {
      kind: 'education';
      entryId: string;
      remove?: false;
      degree: string;
      institution: string;
      start: ZeroDate;
      end: ZeroDate | 'present';
    }
  | { kind: 'education'; entryId: string; remove: true };

/** `finished` is the last answer: the download gate has opened and the profile has been filled. */
export type ZeroCheckResult = { content: ResumeContent; resume: Resume; finished: boolean };
