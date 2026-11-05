import { isSourceUrl } from '@nextkin/shared/models';

/**
 * A KB release date as staff type it: a day (YYYY-MM-DD), or a bare year where the source gives only
 * the year (the backend stores years, `toreview.md` §171.9). Stored days are held at noon UTC.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const YEAR = /^\d{4}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T/;

const isRealDay = (day: string) => {
  const date = new Date(`${day}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
};

/** What the field says is wrong with a typed date, if anything. */
export function dateError(typed: string): string | undefined {
  const v = typed.trim();
  if (!v || YEAR.test(v)) return undefined;
  if (!DAY.test(v)) return 'Use YYYY-MM-DD, or YYYY for a year.';
  return isRealDay(v) ? undefined : 'That day doesn’t exist.';
}

/** What the source field says: a date needs one, and it has to be a web address. */
export function sourceError(date: string, source: string): string | undefined {
  if (source.trim() && !isSourceUrl(source)) return 'Use a web address starting https://.';
  if (date.trim() && !source.trim()) return 'A release date needs a cited source.';
  return undefined;
}

/** A stored date as the field shows it: "2024-12-10", or "2024" for a year. */
export function toTypedDate(stored: string | null): string {
  if (!stored) return '';
  return STAMP.test(stored) ? stored.slice(0, 10) : stored;
}

/** A typed date as the KB stores it; `null` when the field is empty. */
export function toStoredDate(typed: string): string | null {
  const v = typed.trim();
  if (!v) return null;
  return YEAR.test(v) ? v : `${v}T12:00:00.000Z`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A proposed date as a change holds it ("Dec 10, 2024", a stamp or a year), for the edit field. */
export function changeDateToTyped(value: string | null): string {
  if (!value) return '';
  if (STAMP.test(value) || YEAR.test(value) || DAY.test(value)) return toTypedDate(value);
  const shown = /^([a-z]{3})[a-z]* (\d{1,2}), (\d{4})$/i.exec(value.trim());
  const month = shown ? MONTHS.indexOf(shown[1]!.toLowerCase()) : -1;
  if (!shown || month < 0) return value;
  return `${shown[3]}-${String(month + 1).padStart(2, '0')}-${shown[2]!.padStart(2, '0')}`;
}
