const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "Just now", "5m ago", "3h ago", "2d ago", "3w ago", else a short date. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  if (Number.isNaN(then)) return '';
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < 5 * WEEK) return `${Math.floor(diff / WEEK)}w ago`;
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
  if (diff < 5 * WEEK) return pluralize(Math.floor(diff / WEEK), 'week') + ' ago';
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
