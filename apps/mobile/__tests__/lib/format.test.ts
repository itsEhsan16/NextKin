import {
  formatDaysAgo,
  formatJobMeta,
  formatPercent,
  formatRelativeTime,
  formatSalary,
  formatShortDate,
  initialOf,
  pluralize,
  type SalaryRange,
} from '@/lib';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Fixed "now" so every relative-time assertion is deterministic. */
const NOW = new Date('2026-08-23T12:00:00.000Z');

/** ISO timestamp that is `ms` milliseconds before NOW. */
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

/**
 * Builds an ISO string from *local* calendar fields so the day/month/year the
 * formatter reads back (via local getters) is exactly what we asked for,
 * regardless of the machine's time zone.
 */
const localIso = (year: number, monthIndex: number, day: number): string =>
  new Date(year, monthIndex, day, 12, 0, 0).toISOString();

describe('formatRelativeTime', () => {
  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
    expect(formatRelativeTime('', NOW)).toBe('');
  });

  it('returns "Just now" for anything under a minute old', () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe('Just now');
    expect(formatRelativeTime(ago(30_000), NOW)).toBe('Just now');
    expect(formatRelativeTime(ago(MINUTE - 1), NOW)).toBe('Just now');
  });

  it('treats timestamps in the future as "Just now" (clock skew tolerance)', () => {
    expect(formatRelativeTime(ago(-5 * MINUTE), NOW)).toBe('Just now');
  });

  it('formats minutes between 1m and 59m', () => {
    expect(formatRelativeTime(ago(MINUTE), NOW)).toBe('1m ago');
    expect(formatRelativeTime(ago(5 * MINUTE), NOW)).toBe('5m ago');
    expect(formatRelativeTime(ago(5 * MINUTE + 59_000), NOW)).toBe('5m ago');
    expect(formatRelativeTime(ago(HOUR - 1), NOW)).toBe('59m ago');
  });

  it('formats hours between 1h and 23h', () => {
    expect(formatRelativeTime(ago(HOUR), NOW)).toBe('1h ago');
    expect(formatRelativeTime(ago(3 * HOUR + 30 * MINUTE), NOW)).toBe('3h ago');
    expect(formatRelativeTime(ago(DAY - 1), NOW)).toBe('23h ago');
  });

  it('formats days between 1d and 6d', () => {
    expect(formatRelativeTime(ago(DAY), NOW)).toBe('1d ago');
    expect(formatRelativeTime(ago(2 * DAY + 5 * HOUR), NOW)).toBe('2d ago');
    expect(formatRelativeTime(ago(WEEK - 1), NOW)).toBe('6d ago');
  });

  it('formats weeks between 1w and 4w', () => {
    expect(formatRelativeTime(ago(WEEK), NOW)).toBe('1w ago');
    expect(formatRelativeTime(ago(3 * WEEK + 2 * DAY), NOW)).toBe('3w ago');
    expect(formatRelativeTime(ago(5 * WEEK - 1), NOW)).toBe('4w ago');
  });

  it('falls back to a short date at five weeks and beyond', () => {
    const iso = ago(5 * WEEK); // 2026-07-19, same year as NOW -> no year suffix
    const result = formatRelativeTime(iso, NOW);
    expect(result).toBe(formatShortDate(iso, NOW));
    expect(result).toMatch(/^Jul 19$/);

    const old = ago(52 * WEEK); // 2025 -> year suffix, judged against NOW not the wall clock
    expect(formatRelativeTime(old, NOW)).toBe(formatShortDate(old, NOW));
    expect(formatRelativeTime(old, NOW)).toMatch(/, 2025$/);
  });
});

describe('formatShortDate', () => {
  const now = new Date(2026, 7, 23, 12); // 23 Aug 2026, local time

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatShortDate('garbage', now)).toBe('');
  });

  it('omits the year when the date is in the current year', () => {
    expect(formatShortDate(localIso(2026, 7, 12), now)).toBe('Aug 12');
    expect(formatShortDate(localIso(2026, 0, 1), now)).toBe('Jan 1');
    expect(formatShortDate(localIso(2026, 11, 31), now)).toBe('Dec 31');
  });

  it('appends the year when the date is in a different year', () => {
    expect(formatShortDate(localIso(2025, 7, 12), now)).toBe('Aug 12, 2025');
    expect(formatShortDate(localIso(2027, 2, 3), now)).toBe('Mar 3, 2027');
  });

  it('decides "same year" against the supplied reference date', () => {
    const iso = localIso(2025, 5, 15);
    expect(formatShortDate(iso, new Date(2025, 0, 1))).toBe('Jun 15');
    expect(formatShortDate(iso, new Date(2026, 0, 1))).toBe('Jun 15, 2025');
  });
});

describe('formatSalary', () => {
  const usdYear = (range: Partial<SalaryRange>): SalaryRange => ({
    currency: 'USD',
    period: 'year',
    ...range,
  });

  it('formats a full yearly range with compact thousands', () => {
    expect(formatSalary(usdYear({ min: 120_000, max: 150_000 }))).toBe('$120k–$150k / yr');
  });

  it('formats a lower bound only with a trailing plus', () => {
    expect(formatSalary(usdYear({ min: 90_000 }))).toBe('$90k+ / yr');
  });

  it('formats an upper bound only with an "Up to" prefix', () => {
    expect(formatSalary(usdYear({ max: 60_000 }))).toBe('Up to $60k / yr');
  });

  it('reports when neither bound is present', () => {
    expect(formatSalary(usdYear({}))).toBe('Salary not listed');
    expect(formatSalary(usdYear({ min: undefined, max: undefined }))).toBe('Salary not listed');
  });

  it('treats 0 as a real bound, not a missing one', () => {
    expect(formatSalary(usdYear({ min: 0, max: 50_000 }))).toBe('$0–$50k / yr');
  });

  it('rounds non-integer thousands to the nearest k', () => {
    expect(formatSalary(usdYear({ min: 125_500 }))).toBe('$126k+ / yr');
    expect(formatSalary(usdYear({ min: 125_400 }))).toBe('$125k+ / yr');
  });

  it('leaves sub-thousand amounts uncompacted', () => {
    expect(formatSalary(usdYear({ min: 800, period: 'month' }))).toBe('$800+ / mo');
    expect(formatSalary(usdYear({ min: 999 }))).toBe('$999+ / yr');
    expect(formatSalary(usdYear({ min: 1000 }))).toBe('$1k+ / yr');
  });

  it('uses the month suffix', () => {
    expect(formatSalary({ min: 8_000, max: 10_000, currency: 'USD', period: 'month' })).toBe(
      '$8k–$10k / mo',
    );
  });

  it('never compacts hourly rates', () => {
    expect(formatSalary({ min: 45, currency: 'EUR', period: 'hour' })).toBe('€45+ / hr');
    expect(formatSalary({ min: 45, max: 60, currency: 'EUR', period: 'hour' })).toBe(
      '€45–€60 / hr',
    );
    expect(formatSalary({ max: 1_500, currency: 'USD', period: 'hour' })).toBe('Up to $1500 / hr');
  });

  it('uses the right symbol for every supported currency', () => {
    expect(formatSalary({ min: 100_000, currency: 'USD', period: 'year' })).toBe('$100k+ / yr');
    expect(formatSalary({ min: 100_000, currency: 'EUR', period: 'year' })).toBe('€100k+ / yr');
    expect(formatSalary({ min: 100_000, currency: 'AUD', period: 'year' })).toBe('A$100k+ / yr');
  });
});

describe('initialOf', () => {
  it('returns the upper-cased first character', () => {
    expect(initialOf('Acme Inc')).toBe('A');
    expect(initialOf('new relic')).toBe('N');
    expect(initialOf('élan')).toBe('É');
  });

  it('ignores surrounding whitespace', () => {
    expect(initialOf('   stripe')).toBe('S');
    expect(initialOf('\n\tgoogle')).toBe('G');
  });

  it('falls back to "?" for empty or whitespace-only names', () => {
    expect(initialOf('')).toBe('?');
    expect(initialOf('   ')).toBe('?');
  });

  it('keeps digits and symbols as-is', () => {
    expect(initialOf('37signals')).toBe('3');
    expect(initialOf('@home')).toBe('@');
  });
});

describe('formatPercent', () => {
  it('converts a fraction to a rounded whole percentage', () => {
    expect(formatPercent(0.72)).toBe('72%');
    expect(formatPercent(0.666)).toBe('67%');
    expect(formatPercent(0.333)).toBe('33%');
  });

  it('handles the exact bounds', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('clamps values above 1 to 100%', () => {
    expect(formatPercent(1.5)).toBe('100%');
    expect(formatPercent(42)).toBe('100%');
  });

  it('clamps negative values to 0%', () => {
    expect(formatPercent(-0.2)).toBe('0%');
    expect(formatPercent(-10)).toBe('0%');
  });
});

describe('pluralize', () => {
  it('uses the singular form only for exactly one', () => {
    expect(pluralize(1, 'resume')).toBe('1 resume');
  });

  it('appends "s" by default for other counts', () => {
    expect(pluralize(0, 'resume')).toBe('0 resumes');
    expect(pluralize(3, 'resume')).toBe('3 resumes');
    expect(pluralize(2, 'job')).toBe('2 jobs');
  });

  it('uses an explicit plural when supplied', () => {
    expect(pluralize(2, 'match', 'matches')).toBe('2 matches');
    expect(pluralize(1, 'match', 'matches')).toBe('1 match');
    expect(pluralize(0, 'person', 'people')).toBe('0 people');
  });
});

describe('formatSalary — INR (Jobs artboards)', () => {
  const inr = (min: number, max: number, estimated = false) =>
    ({ min, max, currency: 'INR', period: 'year', estimated }) as const;

  it('quotes the symbol and the lakh unit once across the range', () => {
    // Figma 1:307 / 1:319 — "₹28–38L · est." and "₹32–42L".
    expect(formatSalary(inr(2_800_000, 3_800_000, true))).toBe('₹28–38L · est.');
    expect(formatSalary(inr(3_200_000, 4_200_000))).toBe('₹32–42L');
  });

  it('keeps one decimal for part-lakh figures', () => {
    expect(formatSalary(inr(2_850_000, 3_800_000))).toBe('₹28.5–38L');
  });

  it('handles open-ended ranges', () => {
    expect(formatSalary({ min: 2_000_000, currency: 'INR', period: 'year' })).toBe('₹20L+');
    expect(formatSalary({ max: 2_000_000, currency: 'INR', period: 'year' })).toBe('Up to ₹20L');
    expect(formatSalary({ currency: 'INR', period: 'year' })).toBe('Salary not listed');
  });

  it('appends the estimated suffix to the Western currencies too', () => {
    expect(formatSalary({ min: 120_000, max: 150_000, currency: 'USD', period: 'year', estimated: true })).toBe(
      '$120k–$150k / yr · est.',
    );
  });
});

describe('formatDaysAgo', () => {
  const NOW = new Date('2026-08-23T12:00:00.000Z');
  const daysBefore = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  it('counts in days well past a week, unlike formatRelativeTime', () => {
    // The Applied artboard shows "Applied 12d ago" and "Applied 21d ago".
    expect(formatDaysAgo(daysBefore(12), NOW)).toBe('12d ago');
    expect(formatDaysAgo(daysBefore(21), NOW)).toBe('21d ago');
    expect(formatRelativeTime(daysBefore(12), NOW)).toBe('1w ago');
  });

  it('falls back to hours and a date at the edges', () => {
    expect(formatDaysAgo(new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe('3h ago');
    expect(formatDaysAgo(daysBefore(45), NOW)).toBe(formatShortDate(daysBefore(45), NOW));
  });
});

describe('formatJobMeta', () => {
  it('joins the parts with the artboard separator and drops blanks', () => {
    expect(formatJobMeta(['Razorpay', 'Bengaluru', 'Hybrid'])).toBe('Razorpay · Bengaluru · Hybrid');
    expect(formatJobMeta(['Linear', undefined, 'Remote'])).toBe('Linear · Remote');
  });
});
