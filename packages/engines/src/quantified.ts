/**
 * The quantified-outcome detector behind the rubric's achievements component (V2 §7.8; P8-07).
 * A bullet counts when it states a measurable outcome: a number, a percentage, an amount, a scale or
 * a time ("cut onboarding from 5 days to 2", "40%", "$1.2M", "team of 6", "doubled", "three squads").
 *
 * What never counts: a version (Python 3, Java 8, v2.1, 3.x), a year or a date (2019, 03/2020,
 * Q3), and digits that are part of a technology's name (S3, EC2, HTML5, K8s) — the normalizer
 * claims those first.
 */

import { mentionsIn, type Taxonomy } from './normalizer';
import { tokenize } from './text';

const DIGIT = /\d/;
const YEAR = /^(?:19|20)\d{2}$/;
const VERSION = /^v\d+(?:\.\d+)*$|^\d+\.x$|^\d+(?:\.\d+){2,}$/;
const QUARTER = /^q[1-4]$/;
const ORDINAL_DATE = /^\d{1,2}(?:st|nd|rd|th)$/;
/** German month dates read as one token: 03.2020, 1.3.2020. */
const DOTTED_DATE = /^(?:\d{1,2}\.){1,2}(?:19|20)\d{2}$/;
/** Words that state a change of scale on their own. */
const SCALE_WORDS = new Set(['doubled', 'tripled', 'quadrupled', 'halved', 'verdoppelt', 'halbiert']);
/**
 * Quantities written as words ("adopted by three squads"). "One" is left out: it is far more often
 * a pronoun or an article ("one of the first") than a count.
 */
const NUMBER_WORDS = new Set([
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'twenty',
  'dozen', 'dozens', 'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'billions',
]);

export function isQuantified(bullet: string, taxonomy: Taxonomy): boolean {
  const claimed = mentionsIn(taxonomy, bullet);
  const tokens = tokenize(bullet);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== 'word') continue;
    if (SCALE_WORDS.has(token.key) || NUMBER_WORDS.has(token.key)) return true;
    if (!DIGIT.test(token.key)) continue;
    if (claimed.some((m) => token.start >= m.start && token.end <= m.end)) continue;
    if (
      YEAR.test(token.key) ||
      VERSION.test(token.key) ||
      QUARTER.test(token.key) ||
      ORDINAL_DATE.test(token.key) ||
      DOTTED_DATE.test(token.key)
    ) {
      continue;
    }
    // A date written 03/2020 or 2019-2021: a 1–2 digit month beside a slash and a year.
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    if (/^\d{1,2}$/.test(token.key) && (next?.key === '/' || next?.key === '.') && after && YEAR.test(after.key)) {
      i += 2;
      continue;
    }
    return true;
  }
  return false;
}
