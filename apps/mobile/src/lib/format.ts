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

export type SalaryRange = {
  min?: number;
  max?: number;
  currency: 'USD' | 'EUR' | 'AUD';
  period: 'year' | 'month' | 'hour';
};

const currencySymbol: Record<SalaryRange['currency'], string> = {
  USD: '$',
  EUR: '€',
  AUD: 'A$',
};

const compact = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(0)}k`;
  }
  return String(n);
};

/** "$120k–$150k / yr", "€45 / hr", "$90k+" */
export function formatSalary(range: SalaryRange): string {
  const sym = currencySymbol[range.currency];
  const period = range.period === 'year' ? 'yr' : range.period === 'month' ? 'mo' : 'hr';
  const fmt = (n: number) => `${sym}${range.period === 'hour' ? n : compact(n)}`;
  if (range.min != null && range.max != null)
    return `${fmt(range.min)}–${fmt(range.max)} / ${period}`;
  if (range.min != null) return `${fmt(range.min)}+ / ${period}`;
  if (range.max != null) return `Up to ${fmt(range.max)} / ${period}`;
  return 'Salary not listed';
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
