/**
 * How the Content boards write dates and figures. The boards date everything by calendar day
 * ("Oct 28, 2026", "Nov 5"); the fixtures hold those days at noon UTC, so they're formatted in UTC
 * and never slip a day across time zones. A bare year (the KB stores some dates only to the year)
 * is shown as the year.
 */

const YEAR = /^\d{4}$/;

export function formatDay(iso: string | null, withYear = true): string {
  if (!iso) return '—';
  if (YEAR.test(iso)) return iso;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** "Oct 03, 2026": the rubric and templates boards pad the day. */
export function formatPaddedDay(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${String(date.getUTCDate()).padStart(2, '0')}, ${date.getUTCFullYear()}`;
}

/** "Oct 03": a padded day without the year (Skills' merge suggestions). */
export function formatPaddedShort(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** "10:42" in the viewer's own time, for something that just happened. */
export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** An eval score, always two decimals: 0.9 → "0.90", 1 → "1.00". */
export const formatScore = (score: number): string => score.toFixed(2);

/** A per-run cost keeps three decimals: 0.004 → "$0.004". */
export const formatRunCost = (usd: number): string => `$${usd.toFixed(3)}`;

export const formatSeconds = (seconds: number): string => `${seconds} s`;

export const formatCount = (n: number): string => n.toLocaleString('en-US');

/** "1 min ago", "2 min ago", "just now": how long since an autosave. */
export function sinceLabel(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : formatDay(iso);
}

/** The message a refused write carries, for its toast. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'That didn’t go through. Try again.';
