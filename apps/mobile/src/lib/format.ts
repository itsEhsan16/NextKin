const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** "Just now", "5m ago", "3h ago", "2d ago", "3w ago", "2mo ago", else a short date. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  if (Number.isNaN(then)) return '';
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  // Weeks stop at 30 days: the resume cards read a 32-day-old doc as "Edited 1mo ago"
  // (Figma 1:1573), so the month unit takes over where a calendar month begins.
  if (diff < MONTH) return `${Math.floor(diff / WEEK)}w ago`;
  if (diff < 12 * MONTH) return `${Math.max(1, Math.floor(diff / MONTH))}mo ago`;
  return formatShortDate(iso, now);
}

/**
 * Longhand relative time ("2 days ago") for spots where the design spells it out, as opposed
 * to the compact "2d ago" used on dense cards.
 */
export function formatRelativeTimeLong(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = now.getTime() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return pluralize(Math.floor(diff / MINUTE), 'minute') + ' ago';
  if (diff < DAY) return pluralize(Math.floor(diff / HOUR), 'hour') + ' ago';
  if (diff < WEEK) return pluralize(Math.floor(diff / DAY), 'day') + ' ago';
  if (diff < MONTH) return pluralize(Math.floor(diff / WEEK), 'week') + ' ago';
  if (diff < 12 * MONTH) return pluralize(Math.max(1, Math.floor(diff / MONTH)), 'month') + ' ago';
  return formatShortDate(iso, now);
}

/** "12 Aug" or "12 Aug 2025" when not the current year. */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export type SalaryCurrency = 'USD' | 'EUR' | 'AUD' | 'INR';

export type SalaryRange = {
  min?: number;
  max?: number;
  currency: SalaryCurrency;
  period: 'year' | 'month' | 'hour';
  /** Provider-inferred rather than employer-stated; rendered as a "· est." suffix. */
  estimated?: boolean;
};

const currencySymbol: Record<SalaryCurrency, string> = {
  USD: '$',
  EUR: '€',
  AUD: 'A$',
  INR: '₹',
};

const compact = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(0)}k`;
  }
  return String(n);
};

/** Indian salaries are quoted in lakh: 2_800_000 → "28L", 2_850_000 → "28.5L". */
const lakh = (n: number): string => {
  'worklet'; // formatLakh feeds the salary slider's UI-thread readout (RangeValueLabel).
  const value = n / 100_000;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}L`;
};

const ESTIMATED_SUFFIX = ' · est.';

/**
 * INR quotes the symbol and the unit once across the range ("₹28–38L"), unlike the Western
 * currencies which repeat the symbol and carry a period ("$120k–$150k / yr").
 */
function formatInr(range: SalaryRange): string {
  const { min, max } = range;
  if (min != null && max != null) return `₹${lakh(min).replace(/L$/, '')}–${lakh(max)}`;
  if (min != null) return `₹${lakh(min)}+`;
  if (max != null) return `Up to ₹${lakh(max)}`;
  return 'Salary not listed';
}

/** "$120k–$150k / yr", "€45 / hr", "₹28–38L · est.", "$90k+" */
export function formatSalary(range: SalaryRange): string {
  const suffix = range.estimated ? ESTIMATED_SUFFIX : '';

  if (range.currency === 'INR') {
    const base = formatInr(range);
    return base === 'Salary not listed' ? base : `${base}${suffix}`;
  }

  const sym = currencySymbol[range.currency];
  const period = range.period === 'year' ? 'yr' : range.period === 'month' ? 'mo' : 'hr';
  const fmt = (n: number) => `${sym}${range.period === 'hour' ? n : compact(n)}`;
  if (range.min != null && range.max != null)
    return `${fmt(range.min)}–${fmt(range.max)} / ${period}${suffix}`;
  if (range.min != null) return `${fmt(range.min)}+ / ${period}${suffix}`;
  if (range.max != null) return `Up to ${fmt(range.max)} / ${period}${suffix}`;
  return 'Salary not listed';
}

/**
 * Salary as the detail screen spells it — "₹28–38 LPA" (Figma 1:842) where the cards say
 * "₹28–38L". Only the Indian unit is spelled out; other currencies keep their card formatting.
 * The "· est." qualifier is dropped because JOBS 05 sets it as a separate, smaller run.
 */
export function formatSalaryLong(range: SalaryRange): string {
  const base = formatSalary({ ...range, estimated: false });
  if (range.currency !== 'INR') return base;
  return base.endsWith('L') ? `${base.slice(0, -1)} LPA` : base;
}

/**
 * "₹20L", "₹0", "₹80L+" — the salary slider's scale labels. A worklet: the slider's live
 * readout calls it per frame on the UI runtime, where a plain JS closure would throw
 * "Tried to synchronously call a Remote Function".
 */
export function formatLakh(amount: number, opts: { plus?: boolean } = {}): string {
  'worklet';
  if (amount <= 0) return '₹0';
  return `₹${lakh(amount)}${opts.plus ? '+' : ''}`;
}

/**
 * Salary band copy shared by the filter slider and its applied chip (Figma 1:798 / 1:659):
 * "₹20L – ₹45L", "₹20L+" once the upper thumb sits at the ceiling, "Up to ₹45L" with no floor.
 * The chip passes a tighter separator than the slider's readout.
 */
export function formatSalaryBand(
  min: number | undefined,
  max: number | undefined,
  ceiling: number,
  separator = ' – ',
): string {
  const low = min != null && min > 0 ? min : undefined;
  const high = max != null && max < ceiling ? max : undefined;
  if (low != null && high != null) return `${formatLakh(low)}${separator}${formatLakh(high)}`;
  if (low != null) return formatLakh(low, { plus: true });
  if (high != null) return `Up to ${formatLakh(high)}`;
  return 'Any salary';
}

/** "Razorpay · Bengaluru · Hybrid" — the meta line under a job title. */
export function formatJobMeta(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join(' · ');
}

/** "Acme Inc" → "A", "new relic" → "N" */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

/** 0–1 → "72%" */
export function formatPercent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

/** Pluralise with a count: pluralize(3, 'resume') → "3 resumes" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Day-granularity age ("12d ago", "21d ago"). The Applied tab counts in days well past a week
 * — the artboard shows "Applied 21d ago" — where formatRelativeTime would say "3w ago".
 */
export function formatDaysAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = now.getTime() - then;
  if (diff < HOUR) return 'today';
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  return days <= 30 ? `${days}d ago` : formatShortDate(iso, now);
}

/** "Thu 2 Aug" — the interview day on an application status pill (Figma JOBS 03). */
export function formatWeekdayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Notification-feed timestamps (Figma NOTIF 01): "2h ago" today, the bare weekday within the
 * week ("Tue"), then the short date ("24 Jul").
 */
export function formatFeedTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = now.getTime() - then.getTime();
  if (diff < DAY) return formatRelativeTime(iso, now);
  if (diff < WEEK) return then.toLocaleDateString('en-GB', { weekday: 'short' });
  return formatShortDate(iso, now);
}
