/**
 * Web formatting.
 *
 * Deliberately not shared with mobile. `apps/mobile/src/lib/format.ts` renders INR lakh notation
 * on a Reanimated worklet thread; V2 §8.8 asks the web app for a locale-aware layer so a German
 * translation is a content task rather than a refactor, and §13.2 publishes USD/EUR/AUD. Two
 * different jobs, so two implementations over one shared `SalaryRange` type.
 */
import type { SalaryRange } from '@nextkin/shared/models';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "2 hours ago", "Yesterday", "2 days ago" — the Recent Activity and job-card meta line. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 30 * DAY) return relative.format(-Math.floor(elapsed / DAY), 'day');
  if (elapsed < 365 * DAY) return relative.format(-Math.floor(elapsed / (30 * DAY)), 'month');
  return relative.format(-Math.floor(elapsed / (365 * DAY)), 'year');
}

/** The compact form the job cards use: "2d ago", "1d ago". */
export function formatShortAge(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < HOUR) return `${Math.max(1, Math.floor(elapsed / MINUTE))}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

/**
 * "1 day ago", never "Yesterday" — the Jobs board (304:2497) draws the literal count even at one
 * day, where `formatRelativeTime`'s `numeric: 'auto'` (which `RecentActivityCard` depends on for
 * "Yesterday") would collapse it. Same day/hour math, `numeric: 'always'` instead.
 */
const relativeAlways = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function formatPostedAge(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return relativeAlways.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relativeAlways.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 30 * DAY) return relativeAlways.format(-Math.floor(elapsed / DAY), 'day');
  if (elapsed < 365 * DAY) return relativeAlways.format(-Math.floor(elapsed / (30 * DAY)), 'month');
  return relativeAlways.format(-Math.floor(elapsed / (365 * DAY)), 'year');
}

/**
 * "2 days ago", "1 week ago", "3 weeks ago", "2 months ago": the coarse age the Applications
 * board's "Applied" (286:1336-1542) and the Resumes board's "Updated" (304:3140 and on) both read,
 * counting in weeks where the job cards count in days.
 */
export function formatCoarseAge(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < DAY) return 'Today';
  const days = Math.floor(elapsed / DAY);
  if (days < 7) return relativeAlways.format(-days, 'day');
  if (days < 35) return relativeAlways.format(-Math.floor(days / 7), 'week');
  if (days < 365) return relativeAlways.format(-Math.floor(days / 30), 'month');
  return relativeAlways.format(-Math.floor(days / 365), 'year');
}

/**
 * "Updated 2 days ago" (304:3140, 286:2127): the coarse age after a verb, where "Today" reads
 * "today".
 */
export function formatUpdated(iso: string, now: Date = new Date()): string {
  const age = formatCoarseAge(iso, now);
  return `Updated ${age === 'Today' ? 'today' : age}`;
}

/**
 * "2.4 MB", "245 KB" (286:2127): decimal units and at most a tenth of a megabyte, as the Documents
 * board writes them.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${Number((bytes / 1_000_000).toFixed(1))} MB`;
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "May 10, 2024" (286:1600). */
export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthDayLong = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

/** "Sep 28": a date within the year, month first like every other date in the app. */
export function formatMonthDay(iso: string): string {
  return monthDay.format(new Date(iso));
}

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whole calendar days between a moment and now: yesterday at 23:59 is 1, not 0. */
export function calendarDaysBefore(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
}

/**
 * A chat's date in the Assistant's History (771:108-133): Today, Yesterday, "2 days ago" to
 * "6 days ago", "Last week" for the week before, then "Sep 28" (`toreview.md` §96, §102).
 */
export function formatHistoryDate(iso: string, now: Date = new Date()): string {
  const days = calendarDaysBefore(iso, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 10) return 'Last week';
  return formatMonthDay(iso);
}

/** A transcript's day divider (769:583): Today, Yesterday, or "October 8". */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const days = calendarDaysBefore(iso, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return monthDayLong.format(new Date(iso));
}

/**
 * "₹35–52 LPA" (286:1632): lakh per annum, the way Indian listings quote pay. A salary in another
 * currency or period falls back to `formatSalary`.
 */
export function formatSalaryBand(range: SalaryRange): string {
  if (range.currency !== 'INR' || range.period !== 'year') return formatSalary(range);
  const lakh = (amount: number) => String(Number((amount / 100_000).toFixed(1)));
  const body =
    range.min != null && range.max != null
      ? `${lakh(range.min)}–${lakh(range.max)}`
      : lakh(range.min ?? range.max ?? 0);
  return `₹${body} LPA${range.estimated ? ' · est.' : ''}`;
}

export function formatSalary(range: SalaryRange, locale = 'en'): string {
  const currency = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: range.currency,
    maximumFractionDigits: 0,
    notation: 'compact',
  });
  const period = range.period === 'year' ? 'yr' : range.period === 'month' ? 'mo' : 'hr';
  const body =
    range.min != null && range.max != null
      ? `${currency.format(range.min)}–${currency.format(range.max)}`
      : currency.format(range.min ?? range.max ?? 0);
  return `${body}/${period}${range.estimated ? ' · est.' : ''}`;
}

/** "80+ applied" — the provider's applicant count is a floor, never exact. */
export function formatApplicants(count: number): string {
  return `${count}+ applied`;
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
