import type { PayPeriod, PayStatement } from '../models/jdStructured';

/**
 * The numbers in a job posting, read by code (toreview §153): pay, years, days a week, dates. The
 * model says which line is about pay or experience; these read the figures from that line, so a
 * number on the page is always one the posting wrote (G16). Pure, and phone-safe.
 */

const CURRENCY: readonly [RegExp, string][] = [
  [/₹|\brs\.?(?=\s|\d)|\binr\b|\brupees?\b/i, 'INR'],
  [/€|\beur\b|\beuros?\b/i, 'EUR'],
  [/£|\bgbp\b/i, 'GBP'],
  [/\bcad\b|\bc\$/i, 'CAD'],
  [/\baud\b|\ba\$/i, 'AUD'],
  [/\$|\busd\b|\bdollars?\b/i, 'USD'],
];

const PERIOD: readonly [RegExp, PayPeriod][] = [
  [
    /\blpa\b|\bp\.?\s?a\.?(?![a-z])|per\s+annum|\bannual(?:ly)?\b|\byearly\b|(?:per|a|an|\/)\s*(?:year|yr)\b|\bctc\b/i,
    'year',
  ],
  [/\bmonthly\b|(?:per|a|\/)\s*(?:month|mo)\b|\bp\.?\s?m\.?(?![a-z])|\bpm\b/i, 'month'],
  [/\bweekly\b|(?:per|a|\/)\s*week\b/i, 'week'],
  [/\bdaily\b|(?:per|a|\/)\s*day\b/i, 'day'],
  [/\bhourly\b|(?:per|an|a|\/)\s*(?:hour|hr)\b/i, 'hour'],
];

const MULTIPLIER: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  l: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lpa: 1e5,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
  m: 1e6,
  million: 1e6,
};

const NUMBER =
  /(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|lpa|l|crores?|cr|million|m)?(?![a-z])/gi;

/** "70.000" and "70,000" are seventy thousand; "4.5" is four and a half. */
function numberOf(text: string): number {
  if (/^\d{1,3}(?:[,.]\d{3})+$/.test(text)) return Number(text.replace(/[,.]/g, ''));
  return Number(text);
}

/** The currency a pay line names, if it names one. */
export function currencyIn(text: string): string | undefined {
  return CURRENCY.find(([re]) => re.test(text))?.[1];
}

/** The pay period a line names: "monthly", "per annum", "LPA", "/hr". */
export function periodIn(text: string): PayPeriod | undefined {
  return PERIOD.find(([re]) => re.test(text))?.[1];
}

/**
 * The figures in one pay line: "₹45,000 - ₹80,000 monthly" → 45000–80000 INR a month; "4-6 LPA" →
 * 400000–600000 INR a year; "$30/hr" → 30 USD an hour. Null when the line has no figure that could
 * be pay (a bare "1" or "5" is a count, not money).
 */
export function parsePay(
  text: string,
  component: PayStatement['component'] = 'unknown',
): PayStatement | null {
  const found: { value: number; unit?: string }[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const unit = m[2]?.toLowerCase();
    found.push({ value: numberOf(m[1] ?? ''), ...(unit ? { unit } : {}) });
    if (found.length === 2) break;
  }
  if (found.length === 0) return null;
  // "4-6 LPA": the unit after the second figure applies to the first.
  const shared = found[found.length - 1]?.unit;
  const values = found.map((f) => {
    const unit = f.unit ?? (shared && f.value < 1000 ? shared : undefined);
    return f.value * (unit ? (MULTIPLIER[unit] ?? 1) : 1);
  });
  const currency =
    currencyIn(text) ??
    (found.some((f) => f.unit && /^(?:l|lakhs?|lacs?|lpa|cr|crores?)$/.test(f.unit))
      ? 'INR'
      : undefined);
  const period = periodIn(text) ?? (found.some((f) => f.unit === 'lpa') ? 'year' : undefined);
  const money = values.filter((v) => Number.isFinite(v) && v > 0);
  // A pay line names a currency or a figure big enough to be pay; "5 days" is not one.
  if (money.length === 0 || (!currency && Math.max(...money) < 100)) return null;
  const [a, b] = money;
  const min = b === undefined ? a : Math.min(a!, b);
  const max = b === undefined ? a : Math.max(a!, b);
  return {
    component,
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(currency ? { currency } : {}),
    ...(period ? { period } : {}),
  };
}

const WORD_NUMBER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
};
const N =
  '(\\d{1,2}(?:\\.\\d)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)';
const num = (s: string | undefined) =>
  s === undefined ? Number.NaN : (WORD_NUMBER[s.toLowerCase()] ?? Number(s));
const YR = '(?:years?|yrs?|yr)';

const RANGE = new RegExp(`${N}\\s*(?:-|–|—|to)\\s*${N}\\s*\\+?\\s*${YR}`, 'i');
const MIN = new RegExp(
  `(?:min(?:imum)?\\.?(?:\\s+of)?|at\\s+least|over|more\\s+than)\\s+${N}\\s*\\+?\\s*${YR}|${N}\\s*\\+\\s*${YR}|${N}\\s*${YR}\\s+(?:or\\s+more|minimum|min\\b)|${N}\\s*${YR}\\s+(?:of\\s+)?(?:\\w+\\s+){0,2}experience`,
  'i',
);
const FRESHERS =
  /\bfreshers?\b(?!\s+(?:need\s+not|cannot|can't|not))|\bno\s+(?:prior\s+)?experience\s+(?:is\s+)?(?:required|needed|necessary)\b|\bentry[-\s]level\b|\bnew\s+grad(?:uate)?s?\b/i;

export type YearsStated = { min?: number; max?: number; freshersOk?: boolean };

/**
 * The experience a line asks for: "1-3 years" → 1–3; "Min. 1 year" → 1+; "5+ yrs" → 5+;
 * "Freshers can apply" → freshers. Null when the line states none.
 */
export function parseYears(text: string): YearsStated | null {
  const out: YearsStated = {};
  const range = RANGE.exec(text);
  if (range) {
    const a = num(range[1]);
    const b = num(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      out.min = Math.min(a, b);
      out.max = Math.max(a, b);
    }
  } else {
    const min = MIN.exec(text);
    const value = min ? num(min.slice(1).find((g) => g !== undefined)) : Number.NaN;
    if (Number.isFinite(value)) out.min = value;
  }
  if (FRESHERS.test(text)) out.freshersOk = true;
  return out.min !== undefined || out.freshersOk ? out : null;
}

const DAYS = new RegExp(
  `${N}[\\s-]*(?:working\\s+days?|days?(?:\\s+(?:a|per|in\\s+a)\\s+week|\\s*\\/\\s*week|\\s+working|\\s+work\\s+week|\\s+week))`,
  'i',
);

/** "5 days working", "Five working days", "6 days a week" → the number of days. */
export function daysPerWeekIn(text: string): number | undefined {
  const m = DAYS.exec(text);
  const n = num(m?.[1]);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : undefined;
}

export const emailsIn = (text: string): string[] =>
  [...text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0]);

export const urlsIn = (text: string): string[] =>
  [...text.matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)].map((m) => m[0].replace(/[.,;]$/, ''));

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

/**
 * A calendar date a line states, as YYYY-MM-DD: "31 Dec 2026", "December 31, 2026", "2026-12-31",
 * "31/12/2026" (day first, as most postings outside the US write it). Undefined when none.
 */
export function dateIn(text: string): string | undefined {
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  const dmyName = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(20\d{2})\b/i.exec(text);
  const mdyName = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i.exec(text);
  const dmy = /\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/.exec(text);
  let y: number | undefined;
  let mo: number | undefined;
  let d: number | undefined;
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmyName && MONTHS.includes(dmyName[2]!.toLowerCase() as (typeof MONTHS)[number]))
    [y, mo, d] = [
      Number(dmyName[3]),
      MONTHS.indexOf(dmyName[2]!.toLowerCase() as (typeof MONTHS)[number]) + 1,
      Number(dmyName[1]),
    ];
  else if (mdyName && MONTHS.includes(mdyName[1]!.toLowerCase() as (typeof MONTHS)[number]))
    [y, mo, d] = [
      Number(mdyName[3]),
      MONTHS.indexOf(mdyName[1]!.toLowerCase() as (typeof MONTHS)[number]) + 1,
      Number(mdyName[2]),
    ];
  else if (dmy) [y, mo, d] = [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])];
  if (!y || !mo || !d || mo > 12 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
