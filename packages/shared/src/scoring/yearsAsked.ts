import type { TailorImprovement } from '../models';

/**
 * Jobright's "Years of experience" row (toreview §113): the years the JD asks for beside the dated
 * experience the resume shows. Pure; the months are counted by the caller (`pageBudget`).
 */

/** The years a JD asks for: "0–2 years", "3+ years", or an entry-level job's 0–2. */
export type YearsAsked = { min: number; max?: number };

const RANGE = /(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/i;
const AT_LEAST =
  /(\d{1,2})\s*\+\s*(?:years?|yrs?)\b|(?:at least|minimum(?: of)?)\s*(\d{1,2})\s*(?:years?|yrs?)\b|(\d{1,2})\s*(?:years?|yrs?)\s+of\s+(?:professional\s+|relevant\s+|work\s+)?experience/i;

export function yearsAskedOf(rawText: string, level?: string): YearsAsked | null {
  const range = RANGE.exec(rawText);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const least = AT_LEAST.exec(rawText);
  const n = least ? Number(least[1] ?? least[2] ?? least[3]) : Number.NaN;
  if (Number.isFinite(n)) return { min: n };
  return level === 'entry' ? { min: 0, max: 2 } : null;
}

const yearsWord = (n: number) => `${n} year${n === 1 ? '' : 's'}`;
const askedText = (a: YearsAsked) => (a.max !== undefined ? `${a.min}–${yearsWord(a.max)}` : `${yearsWord(a.min)} or more`);
const shownText = (months: number) => (months < 12 ? 'under a year' : `about ${yearsWord(Math.floor(months / 12))}`);

export function yearsRow(asked: YearsAsked, shownMonths: number): TailorImprovement {
  const ok = shownMonths >= asked.min * 12 - 6;
  return {
    key: 'years',
    label: 'Years of experience',
    detail: `This job asks for ${askedText(asked)}; your resume shows ${shownText(shownMonths)} of dated experience.${ok ? '' : ' Tailoring can’t add years: lead with what you have done.'}`,
    ok,
  };
}
