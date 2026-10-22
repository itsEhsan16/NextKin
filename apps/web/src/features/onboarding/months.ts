/** Months as ONB 05 handles them: `YYYY-MM`, shown as "Mar 2022" (816:25). */

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

export function parseMonth(key: string): { year: number; month: number } {
  const [year = '0', month = '1'] = key.split('-');
  return { year: Number(year), month: Number(month) - 1 };
}

export function monthLabel(key: string): string {
  const { year, month } = parseMonth(key);
  return `${MONTH_NAMES[month] ?? ''} ${year}`;
}

export function currentMonth(now = new Date()): string {
  return monthKey(now.getFullYear(), now.getMonth());
}

/** A profile date (`YYYY-MM-DD`) as its month. */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** A month's first day, as a role's start date. */
export const startOfMonth = (key: string) => `${key}-01`;

/** A month's last day, as a role's end date (the profile stores "2022-02-28"). */
export function endOfMonth(key: string): string {
  const { year, month } = parseMonth(key);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, '0')}`;
}
