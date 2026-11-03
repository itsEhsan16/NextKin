import type { JdQuote } from '../models/jdStructured';

/**
 * Where a quote sits in a posting (toreview §153). Quotes are compared the way extraction compares
 * them — letter case, curly quotes, dashes and runs of space aside — and the match is mapped back to
 * offsets in the original text, so the page can point at the words a fact came from.
 */

const fold = (c: string): string => {
  if (c === '‘' || c === '’') return "'";
  if (c === '“' || c === '”') return '"';
  if (c === '–' || c === '—') return '-';
  return c.toLowerCase();
};

/** The folded text and, for each of its characters, the index it came from. */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      if (!space && folded.length > 0) {
        folded += ' ';
        map.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    const f = fold(c);
    for (let k = 0; k < f.length; k += 1) {
      folded += f[k];
      map.push(i);
    }
  }
  if (folded.endsWith(' ')) {
    folded = folded.slice(0, -1);
    map.pop();
  }
  return { folded, map };
}

/** A posting, folded once, for locating many quotes in it. */
export type Haystack = { raw: string; folded: string; map: number[] };

export function haystackOf(raw: string): Haystack {
  return { raw, ...foldWithMap(raw) };
}

/**
 * The quote's place in the posting, or null when the posting does not contain it. `from` finds a
 * later occurrence, so a line said twice can be told apart.
 */
export function locate(hay: Haystack, quote: string, from = 0): JdQuote | null {
  const needle = foldWithMap(quote.trim()).folded;
  if (!needle) return null;
  const at = hay.folded.indexOf(needle, from);
  if (at < 0) return null;
  const start = hay.map[at]!;
  const end = hay.map[at + needle.length - 1]! + 1;
  return { text: hay.raw.slice(start, end), start, end };
}

/** Every place the quote appears. */
export function locateAll(hay: Haystack, quote: string): JdQuote[] {
  const out: JdQuote[] = [];
  const needle = foldWithMap(quote.trim()).folded;
  if (!needle) return out;
  let at = hay.folded.indexOf(needle);
  while (at >= 0 && out.length < 10) {
    const start = hay.map[at]!;
    const end = hay.map[at + needle.length - 1]! + 1;
    out.push({ text: hay.raw.slice(start, end), start, end });
    at = hay.folded.indexOf(needle, at + needle.length);
  }
  return out;
}

/** Whether two quotes overlap in the text. */
export const overlaps = (a: JdQuote, b: JdQuote): boolean => a.start < b.end && b.start < a.end;
