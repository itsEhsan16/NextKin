import { formatCoarseAge, formatSalary, formatSalaryBand, formatShortDate } from '@/lib/format';

const NOW = new Date('2026-09-10T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('formatCoarseAge', () => {
  // The Applications board counts in weeks where the job cards count in days (286:1336-1542).
  it.each([
    [0.5, 'Today'],
    [1, '1 day ago'],
    [2, '2 days ago'],
    [7, '1 week ago'],
    [13, '1 week ago'],
    [14, '2 weeks ago'],
    [28, '4 weeks ago'],
    [34, '4 weeks ago'],
    [36, '1 month ago'],
    [75, '2 months ago'],
    [400, '1 year ago'],
  ])('%s days back reads "%s"', (days, label) => {
    expect(formatCoarseAge(daysAgo(days), NOW)).toBe(label);
  });
});

describe('formatSalaryBand', () => {
  it('quotes Indian yearly pay in lakh per annum', () => {
    expect(
      formatSalaryBand({ min: 3_500_000, max: 5_200_000, currency: 'INR', period: 'year' }),
    ).toBe('₹35–52 LPA');
  });

  it('keeps the estimate marker', () => {
    expect(
      formatSalaryBand({
        min: 1_500_000,
        max: 1_950_000,
        currency: 'INR',
        period: 'year',
        estimated: true,
      }),
    ).toBe('₹15–19.5 LPA · est.');
  });

  it('falls back to the compact currency form for anything else', () => {
    const usd = { min: 120_000, max: 150_000, currency: 'USD', period: 'year' } as const;
    expect(formatSalaryBand(usd)).toBe(formatSalary(usd));
  });
});

describe('formatShortDate', () => {
  it('reads as the board does', () => {
    expect(formatShortDate('2024-05-10T12:00:00Z')).toBe('May 10, 2024');
  });
});
