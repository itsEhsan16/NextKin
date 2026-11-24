import { describe, expect, it } from 'vitest';

import { experienceMonths, pageBudget } from '../src/scoring/pageBudget';

/** The page budget (toreview §111.1): a fresher gets one page, an experienced resume up to two. */

const role = (start: string, end: string | null) => ({ start, end }) as never;
const asOf = { year: 2026, month: 10 };

describe('pageBudget', () => {
  it('counts overlapping roles once and a current role up to now', () => {
    expect(experienceMonths({ roles: [role('2024-01', '2024-12'), role('2024-06', '2025-05')] }, asOf)).toBe(17);
    expect(experienceMonths({ roles: [role('2025-10', null)] }, asOf)).toBe(13);
    expect(experienceMonths({ roles: [role('2023', '2023')] }, asOf)).toBe(1);
  });

  it('gives a fresher one page, with its basis', () => {
    const budget = pageBudget({ roles: [role('2024-11', null)] }, asOf, 2);
    expect(budget).toMatchObject({ pages: 1, months: 24 });
    expect(budget.basis).toBe('Fitted to 1 page: under 3 years of experience (2 years)');
    expect(pageBudget({ roles: [] }, asOf).basis).toContain('under a year');
    // A three-month internship, as a 2026 graduate has.
    expect(pageBudget({ roles: [role('2025-07', '2025-09')] }, asOf, 2)).toMatchObject({ pages: 1, months: 3 });
  });

  it('counts three years as experienced: 58 months over two employers keeps two pages', () => {
    const roles = [role('2020-05', '2023-12'), role('2025-10', null)];
    expect(pageBudget({ roles }, { year: 2026, month: 11 }, 3)).toMatchObject({ pages: 2, months: 58 });
    expect(pageBudget({ roles: [role('2023-11', null)] }, asOf, 2)).toMatchObject({ pages: 2, months: 36 });
  });

  it('keeps an experienced resume at its own length, at most two pages', () => {
    const roles = [role('2015-01', '2020-12'), role('2021-01', null)];
    expect(pageBudget({ roles }, asOf, 1)).toMatchObject({ pages: 1 });
    expect(pageBudget({ roles }, asOf, 3)).toMatchObject({ pages: 2 });
    expect(pageBudget({ roles }, asOf).pages).toBe(2);
    expect(pageBudget({ roles }, asOf, 1).basis).toBe('Kept to 1 page, as the original: 11 years of experience');
  });
});
