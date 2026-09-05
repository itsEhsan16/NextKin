import {
  initialSelection,
  parseMonthYear,
  resolveSelection,
  yearOptions,
} from '@/ui/MonthYearSheet';

/** 5 Sep 2026, built from local calendar fields — the sheet reads local fields too. */
const NOW = new Date(2026, 8, 5);

/** The strip a profile date sheet offers in these tests. */
const BOUNDS = { minYear: 2016, maxYear: 2026, now: NOW };

describe('monthYearMath (Phase 9F profile dates)', () => {
  describe('parseMonthYear', () => {
    it('reads the month and year off a stored ISO day', () => {
      expect(parseMonthYear('2022-03-01')).toEqual({ year: 2022, month: 3 });
      expect(parseMonthYear('1999-12-01T00:00:00.000Z')).toEqual({ year: 1999, month: 12 });
    });

    it('round-trips whatever the sheet resolved', () => {
      const iso = resolveSelection({ year: 2022, month: 3, present: false }, false);
      expect(parseMonthYear(iso)).toEqual({ year: 2022, month: 3 });
    });

    it('returns null rather than a plausible-looking wrong date', () => {
      expect(parseMonthYear(undefined)).toBeNull();
      expect(parseMonthYear('')).toBeNull();
      expect(parseMonthYear('present')).toBeNull();
      expect(parseMonthYear('March 2022')).toBeNull();
      expect(parseMonthYear('2022-3-01')).toBeNull();
      expect(parseMonthYear('2022-13-01')).toBeNull();
      expect(parseMonthYear('2022-00-01')).toBeNull();
    });
  });

  describe('yearOptions', () => {
    it('runs newest first, both ends inclusive', () => {
      const years = yearOptions(2016, 2026);
      expect(years).toHaveLength(11);
      expect(years[0]).toBe(2026);
      expect(years[years.length - 1]).toBe(2016);
      expect([...years].sort((a, b) => b - a)).toEqual(years);
    });

    it('offers a single year when both ends meet', () => {
      expect(yearOptions(2026, 2026)).toEqual([2026]);
    });
  });

  describe('initialSelection', () => {
    it('seeds from a stored date', () => {
      expect(initialSelection({ value: '2019-07-01', allowPresent: false, ...BOUNDS })).toEqual({
        year: 2019,
        month: 7,
        present: false,
      });
    });

    it('clamps a year the strip does not offer, so the seeded chip is re-pickable', () => {
      expect(initialSelection({ value: '1998-07-01', allowPresent: false, ...BOUNDS })).toEqual({
        year: 2016,
        month: 7,
        present: false,
      });
      expect(initialSelection({ value: '2044-07-01', allowPresent: false, ...BOUNDS })).toEqual({
        year: 2026,
        month: 7,
        present: false,
      });
    });

    it("honours 'present' only on a field that offers it", () => {
      expect(initialSelection({ value: 'present', allowPresent: true, ...BOUNDS })).toEqual({
        year: 2026,
        month: 9,
        present: true,
      });
      expect(initialSelection({ value: 'present', allowPresent: false, ...BOUNDS })).toEqual({
        year: 2026,
        month: 9,
        present: false,
      });
    });

    it('falls back to now when there is nothing to read', () => {
      expect(initialSelection({ allowPresent: true, ...BOUNDS })).toEqual({
        year: 2026,
        month: 9,
        present: false,
      });
      expect(initialSelection({ value: 'not a date', allowPresent: true, ...BOUNDS })).toEqual({
        year: 2026,
        month: 9,
        present: false,
      });
    });
  });

  describe('resolveSelection', () => {
    it('returns the sentinel only where the field allows it', () => {
      const ongoing = { year: 2022, month: 3, present: true };
      expect(resolveSelection(ongoing, true)).toBe('present');
      expect(resolveSelection(ongoing, false)).toBe('2022-03-01');
    });

    it('pins a picked month to its first day', () => {
      expect(resolveSelection({ year: 2022, month: 3, present: false }, true)).toBe('2022-03-01');
      expect(resolveSelection({ year: 2016, month: 12, present: false }, true)).toBe('2016-12-01');
    });
  });
});
