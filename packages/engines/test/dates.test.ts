import { describe, expect, it } from 'vitest';

import { endYear, formatPartialDate, monthRange, parsePartialDate, spansOverlap, unionMonths } from '../src/dates';

const asOf = { year: 2026, month: 10 };

describe('partial dates', () => {
  it('reads years, months and full dates, and refuses anything else', () => {
    expect(parsePartialDate('2019')).toEqual({ year: 2019 });
    expect(parsePartialDate('2019-03')).toEqual({ year: 2019, month: 3 });
    expect(parsePartialDate(' 2019-03-17 ')).toEqual({ year: 2019, month: 3 });
    for (const bad of ['2019-13', '2019-00', 'March 2019', '19', '', null, undefined]) expect(parsePartialDate(bad)).toBeNull();
  });

  it('formats back to ISO precision', () => {
    expect(formatPartialDate({ year: 2019 })).toBe('2019');
    expect(formatPartialDate({ year: 2019, month: 3 })).toBe('2019-03');
  });

  it('reads "present" as asOf and never guesses a missing end', () => {
    expect(endYear({ start: { year: 2020 }, end: null }, asOf)).toBe(2026);
    expect(endYear({ start: { year: 2020 } }, asOf)).toBeNull();
    expect(endYear({ start: { year: 2020 }, end: { year: 2022 } }, asOf)).toBe(2022);
    expect(monthRange({ start: { year: 2020 } }, asOf)).toEqual([2020 * 12, 2020 * 12]);
    expect(monthRange({ end: null }, asOf)).toBeNull();
    expect(monthRange({ start: { year: 2022, month: 5 }, end: { year: 2021 } }, asOf)).toEqual([2022 * 12 + 4, 2022 * 12 + 4]);
  });

  it('counts overlapping months once', () => {
    expect(unionMonths([[0, 12], [6, 18], [24, 30], [25, 26]])).toBe(24);
    expect(unionMonths([])).toBe(0);
  });

  it('knows when two spans overlap', () => {
    const a = { start: { year: 2018 }, end: { year: 2020 } };
    expect(spansOverlap(a, { start: { year: 2019 }, end: null }, asOf)).toBe(true);
    expect(spansOverlap(a, { start: { year: 2021 }, end: null }, asOf)).toBe(false);
    expect(spansOverlap(a, { end: null }, asOf)).toBe(false);
  });
});
