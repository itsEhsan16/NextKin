import type { Experience, Profile } from '@nextkin/shared/models';

/**
 * How the Profile board (476:4) reads the profile. The account-wide reads it shares with Settings
 * (`experienceBand`, `completionItems`, …) stay in `accountLibrary`.
 */

/** The six sections (476:31), in the board's order. Only Overview is drawn. */
export type ProfileTab =
  'overview' | 'experience' | 'education' | 'skills' | 'preferences' | 'links';

export const PROFILE_TABS: readonly { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'preferences', label: 'Career preferences' },
  { id: 'links', label: 'Social links' },
];

export const isProfileTab = (value: string): value is ProfileTab =>
  PROFILE_TABS.some((tab) => tab.id === value);

/** How many skill chips Overview shows before "+3" (476:908). */
export const OVERVIEW_SKILLS = 7;

/** How many roles Overview shows before "View all" (476:691). */
export const OVERVIEW_ROLES = 2;

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthLabel = (iso: string): string => MONTH.format(new Date(`${iso}T00:00:00Z`));

/** Whole months from one ISO date to another: June 2020 to December 2021 is 18 (476:709). */
function monthsBetween(start: string, end: string): number {
  const [sy = 0, sm = 1] = start.split('-').map(Number);
  const [ey = 0, em = 1] = end.split('-').map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm));
}

/** "1.5 years", "4+ years", "8 months": how the board states a role's length (476:700, 709). */
export function durationLabel(months: number): string {
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = months / 12;
  if (Number.isInteger(years)) return `${years} year${years === 1 ? '' : 's'}`;
  if (months % 12 === 6) return `${years} years`;
  return `${Math.floor(years)}+ year${Math.floor(years) === 1 ? '' : 's'}`;
}

/**
 * "Jan 2022 – Present · 2+ years" (476:700). The length is worked out from the dates rather than
 * copied: the board's "2+ years" for a role begun in January 2022 was true when it was drawn and
 * isn't now (`toreview.md` §91).
 */
export function roleDates(role: Experience, today = new Date()): string {
  const end = role.current || !role.endDate ? today.toISOString().slice(0, 10) : role.endDate;
  const span = `${monthLabel(role.startDate)} – ${role.current ? 'Present' : monthLabel(end)}`;
  return `${span}  ·  ${durationLabel(monthsBetween(role.startDate, end))}`;
}

/**
 * "Jul 2016 – May 2020": a qualification's years, for the Education tab. An end known only by its
 * year (web onboarding's "Year finished") prints as the year, and with no start of its own, alone:
 * "2017", never a month nobody gave.
 */
export function studyDates(
  start: string,
  end: string | undefined,
  current: boolean,
  endPrecision?: 'year',
): string {
  if (!current && end && endPrecision === 'year') {
    const year = end.slice(0, 4);
    return !start || start === end ? year : `${monthLabel(start)} – ${year}`;
  }
  return `${monthLabel(start)} – ${current || !end ? 'Present' : monthLabel(end)}`;
}

/** "Bengaluru, Remote" (476:984): the first two places wanted, each by its city alone. */
export const preferredLocations = (profile: Profile): string | undefined =>
  profile.preferences.locations
    .slice(0, 2)
    .map((place) => place.split(',')[0]?.trim())
    .filter(Boolean)
    .join(', ') || undefined;

/** "AI profile suggestions" (477:16), each with the glyph the board gives it. */
export type Suggestion = {
  id: 'skills' | 'summary' | 'portfolio' | 'impact';
  label: string;
};

export const SUGGESTIONS: readonly Suggestion[] = [
  { id: 'skills', label: 'Add 2–3 more skills' },
  { id: 'summary', label: 'Write a stronger summary' },
  { id: 'portfolio', label: 'Add a portfolio link' },
  { id: 'impact', label: 'Highlight measurable impact in your experience' },
];
