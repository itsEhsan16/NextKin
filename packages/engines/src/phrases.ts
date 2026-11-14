/**
 * JD phrases the taxonomy does not know ("user interfaces", "code reviews", "KYC"), found in a
 * resume's own text (toreview §112). A requirement with an `x:` id used to be met only by an
 * identical skills-list entry; a bullet that said it earned nothing. Here a phrase is found as whole
 * words in order, punctuation between them ignored, a word's common endings folded either side:
 * "user interface" meets "user interfaces", "workflow automation" meets "automated workflows"
 * only where the words come in the same order. Pure.
 */

import { phraseKey, tokenize } from './text';

export interface PhraseMention {
  /** The requirement's skill id (`x:<phrase key>`). */
  id: string;
  start: number;
  end: number;
  surface: string;
}

/**
 * A word as compared: lower case, with its common endings folded so one word's forms meet
 * (toreview §206.2): "dashboards" and "dashboard"; "automate", "automated", "automating" and
 * "automation"; "policies" and "policy". Deliberately light: endings only, on words long enough
 * that the stem is still the word, and only ever for a phrase the taxonomy does not know. A named
 * skill is matched by its aliases, never by this.
 */
export function stem(key: string): string {
  let word = key;
  if (word.length >= 5 && word.endsWith('ies')) word = `${word.slice(0, -3)}y`;
  else if (word.length >= 4 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) word = word.slice(0, -1);
  if (word.length >= 8 && word.endsWith('tion')) word = word.slice(0, -3);
  else if (word.length >= 7 && word.endsWith('ing')) word = word.slice(0, -3);
  else if (word.length >= 6 && word.endsWith('ed')) word = word.slice(0, -2);
  if (word.length >= 5 && word.endsWith('e')) word = word.slice(0, -1);
  return word;
}

/** The phrases' ids and stemmed words, from `x:` skill ids. */
export function phraseIndex(ids: Iterable<string>): { id: string; words: string[] }[] {
  const out: { id: string; words: string[] }[] = [];
  for (const id of new Set(ids)) {
    if (!id.startsWith('x:')) continue;
    const words = tokenize(id.slice(2)).filter((t) => t.kind === 'word').map((t) => stem(t.key));
    if (words.length > 0) out.push({ id, words });
  }
  return out;
}

export function phraseMentions(text: string, phrases: readonly { id: string; words: string[] }[]): PhraseMention[] {
  if (phrases.length === 0 || !text) return [];
  const words = tokenize(text).filter((t) => t.kind === 'word');
  const keys = words.map((w) => stem(w.key));
  const out: PhraseMention[] = [];
  for (const phrase of phrases) {
    const n = phrase.words.length;
    for (let i = 0; i + n <= keys.length; i++) {
      if (phrase.words.every((w, j) => keys[i + j] === w)) {
        const start = words[i]!.start;
        const end = words[i + n - 1]!.end;
        out.push({ id: phrase.id, start, end, surface: text.slice(start, end) });
        break;
      }
    }
  }
  return out;
}

/** The `x:` id a written phrase resolves to, as `resolveSkill` builds it for an unknown phrase. */
export const phraseId = (text: string) => `x:${phraseKey(text)}`;
