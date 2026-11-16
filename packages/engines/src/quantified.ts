/**
 * The quantified-outcome detector behind the rubric's achievements component (V2 §7.8; P8-07).
 * A bullet counts when it states a measurable outcome: a number, a percentage, an amount, a scale or
 * a time ("cut onboarding from 5 days to 2", "40%", "$1.2M", "team of 6", "doubled", "three squads").
 *
 * What never counts: a version (Python 3, Java 8, v2.1, 3.x), a year or a date (2019, 03/2020,
 * Q3), and digits that are part of a technology's name (S3, EC2, HTML5, K8s) — the normalizer
 * claims those first.
 *
 * Nor does a number that measures nothing (engine 1.3.0, toreview §212): "improving 10" and "role
 * based access by 100" say no unit and no counted thing. A number counts with a unit on it (40%,
 * $1.2M, 3x, 200ms), a thing it counts after it ("6 engineers", "5 days"), or as a size or the end
 * of a range ("team of 6", "from 5 days to 2").
 */

import { mentionsIn, type Taxonomy } from './normalizer';
import { tokenize, type Token } from './text';

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

/** A unit written onto the number: 3x, 10k, 1.2m, 200ms, 4h, 50+. */
const UNIT_SUFFIX = /^\d[\d.,]*(?:x|k|m|bn|b|ms|s|sec|secs|min|mins|h|hr|hrs|d|gb|mb|tb|kb|\+)$/;
const CURRENCY = new Set(['$', '€', '£', '₹', '¥']);
/** After a number, these start another thought: they are not the thing it counts. */
const NOT_COUNTED = new Set(['and', 'or', 'but', 'in', 'on', 'at', 'for', 'with', 'by', 'the', 'a', 'an', 'as', 'while', 'through', 'using', 'via', 'und', 'oder']);
/** Before a bare number, these make it a size or the end of a range. */
const SIZE_BEFORE = new Set(['of', 'to', 'von', 'bis', 'auf']);

/** Whether the number at `i` measures something: a unit, a counted thing, a size or a range. */
function measures(tokens: readonly Token[], i: number): boolean {
  const token = tokens[i]!;
  const next = tokens[i + 1];
  const before = tokens[i - 1];
  if (UNIT_SUFFIX.test(token.key)) return true;
  if (next?.key === '%' || next?.key === '×') return true;
  if (before && CURRENCY.has(before.key)) return true;
  if (next?.kind === 'word' && !NOT_COUNTED.has(next.key)) return true;
  // "5-day", "3-person": a hyphen straight into the thing counted.
  if (next?.key === '-' && tokens[i + 2]?.kind === 'word') return true;
  return before?.kind === 'word' && SIZE_BEFORE.has(before.key);
}

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
    if (measures(tokens, i)) return true;
  }
  return false;
}

/**
 * A line that only says what was used or known ("Used Git and pull requests…", "Applied OOP…",
 * "Familiar with Docker"), not what was done (toreview §159). The merge drops a written line like
 * this that lists ticked keywords. Every line without a figure may still be asked for a result
 * (owner, toreview §162).
 */
const TOOL_ONLY_OPENERS = new Set([
  'used', 'using', 'applied', 'utilized', 'utilised', 'worked', 'familiar', 'knowledge', 'exposure',
  'experience', 'experienced', 'proficient', 'skilled', 'learned', 'learnt', 'studied', 'responsible',
  'participated', 'attended', 'completed',
]);

/** "Used …", "Applied …", "Familiar with …": a line that says what was used, not what was done. */
export function isToolUseLine(bullet: string): boolean {
  const first = (bullet.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return TOOL_ONLY_OPENERS.has(first);
}
