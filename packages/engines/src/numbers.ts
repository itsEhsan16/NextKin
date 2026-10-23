/**
 * Numbers stated in a text, as values (P9-04's numeric integrity). "40M+", "40 million" and
 * "40,000,000" are the same number; "three squads" is 3. Years, dates, versions and the digits
 * inside technology names (S3, EC2, HTML5) are not quantities and are skipped, as the quantified
 * detector skips them.
 */

import { mentionsIn, type Taxonomy } from './normalizer';

const SCALE: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, cr: 1e7, crore: 1e7, lakh: 1e5,
};
const WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, dozen: 12,
};
const NUMBER = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mn|million|m|bn|billion|b|crore|cr|lakh)?(?![\p{L}\d])/giu;
// No lookbehind (Hermes): the word's left edge is matched as a non-letter or the start, then skipped.
const WORD = /(^|[^\p{L}])(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|dozen)(?![\p{L}])/giu;
const YEAR = /^(?:19|20)\d{2}$/;

export interface StatedNumber {
  value: number;
  raw: string;
  start: number;
  end: number;
}

/** Every quantity a text states. */
export function numbersIn(text: string, taxonomy: Taxonomy): StatedNumber[] {
  const claimed = mentionsIn(taxonomy, text);
  const out: StatedNumber[] = [];
  for (const match of text.matchAll(NUMBER)) {
    const start = match.index;
    const end = start + match[0].length;
    if (claimed.some((m) => start >= m.start && start < m.end)) continue;
    const before = text[start - 1] ?? '';
    // v2.1, Q3, a dotted date (03.2020) or a slashed one (03/2020).
    if (/[vVqQ.]/.test(before)) continue;
    const digits = match[1]!.replace(/,/g, '');
    if (!match[2] && YEAR.test(digits)) continue;
    if (/^\d{1,2}$/.test(digits) && /^[/.]\d{4}/.test(text.slice(end))) continue;
    const scale = match[2] ? SCALE[match[2].toLowerCase()] ?? 1 : 1;
    out.push({ value: Number(digits) * scale, raw: match[0].trim(), start, end });
  }
  for (const match of text.matchAll(WORD)) {
    const start = match.index + match[1]!.length;
    out.push({ value: WORDS[match[2]!.toLowerCase()]!, raw: match[2]!, start, end: start + match[2]!.length });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Values equal within rounding: 1.2M and 1,200,000 match; 18% and 18.4% do not. */
export function sameNumber(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale > 0 && Math.abs(a - b) / scale < 1e-9;
}
