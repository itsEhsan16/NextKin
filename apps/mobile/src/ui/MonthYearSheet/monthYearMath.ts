/**
 * Pure month/year maths for the profile date sheet, kept out of the component so the parse,
 * clamp and sentinel rules get real coverage without mounting anything (the rangeMath /
 * swipeMath precedent).
 *
 * A profile date is an ISO day pinned to the first of its month, or the 'present' sentinel for
 * a role someone still holds. Nothing in the profile stores a day of the month, so the sheet
 * never asks for one.
 */
import { monthYearToIso } from '@/lib';

/** An ISO 'YYYY-MM-DD', or the sentinel for an ongoing role. */
export type MonthYearValue = string | 'present';

/** What the open sheet holds. `month` is 1-12 — a calendar month, not a Date's 0-11. */
export type MonthYearSelection = { year: number; month: number; present: boolean };

export const MONTH_SHORT: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Read with a regex rather than `new Date(iso)`: the Date constructor treats a bare
 * 'YYYY-MM-DD' as UTC midnight, so `getMonth()` west of Greenwich hands back the month before.
 * The trailing day (and any time part) is matched but ignored — only the month is stored.
 */
const ISO_MONTH = /^(\d{4})-(\d{2})(?:-\d{2})?/;

export function parseMonthYear(iso: string | undefined): { year: number; month: number } | null {
  if (!iso) return null;
  const match = ISO_MONTH.exec(iso);
  if (!match) return null;
  const [, rawYear, rawMonth] = match;
  if (!rawYear || !rawMonth) return null;
  const month = Number(rawMonth);
  if (month < 1 || month > 12) return null;
  return { year: Number(rawYear), month };
}

/** Newest first: profile dates are nearly always recent, so the answer sits at the top. */
export function yearOptions(minYear: number, maxYear: number): number[] {
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) years.push(year);
  return years;
}

const clampYear = (year: number, minYear: number, maxYear: number): number =>
  Math.min(maxYear, Math.max(minYear, year));

export function initialSelection({
  value,
  allowPresent,
  minYear,
  maxYear,
  now,
}: {
  value?: MonthYearValue;
  allowPresent: boolean;
  minYear: number;
  maxYear: number;
  now: Date;
}): MonthYearSelection {
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };
  // A field that was saved as ongoing, on a sheet that no longer offers it, falls through to
  // the parse below — 'present' is not a date, so it lands on today rather than on nothing.
  if (value === 'present' && allowPresent) return { ...today, present: true };

  const parsed = parseMonthYear(value);
  // A stored year can sit outside the strip this sheet offers; clamping keeps the selected chip
  // one the user can actually see and re-pick.
  if (parsed) {
    return { year: clampYear(parsed.year, minYear, maxYear), month: parsed.month, present: false };
  }
  return { ...today, present: false };
}

export function resolveSelection(sel: MonthYearSelection, allowPresent: boolean): MonthYearValue {
  if (sel.present && allowPresent) return 'present';
  return monthYearToIso(sel.year, sel.month);
}
