/**
 * The one tokenizer every engine reads text through (normalizer, quantified outcomes, lint, pasted
 * text). Skill names carry symbols — C++, C#, .NET, Node.js, CI/CD — so word boundaries in the
 * regex sense (`\b`) cannot find them (ImBackendImplementationPlan P8-02). Instead text becomes a
 * list of tokens: words that keep their internal symbols, and single punctuation marks, each with
 * its character offsets so a match can point back at the exact span it came from.
 *
 * Lower-casing uses `String.prototype.toLowerCase`, the Unicode default case mapping, which does
 * not depend on the runtime's locale. `toLocaleLowerCase` and `normalize` are avoided (the purity
 * fence bans the first; the second depends on the runtime's Unicode tables).
 */

export type TokenKind = 'word' | 'punct';

export interface Token {
  /** Lower-cased text, used for matching. */
  key: string;
  /** The text as written. */
  raw: string;
  kind: TokenKind;
  /** Character offsets into the source, end exclusive. */
  start: number;
  end: number;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

/**
 * Splits text into tokens. A word is a run of letters and digits, extended by:
 * - `.` between word characters (node.js, asp.net, 3.11) or before one at a word start (.net);
 * - trailing `+` and `#` (c++, c#, angular 2+);
 * - a leading `.` when it opens a word (.NET).
 * Everything else that is not whitespace is a one-character punctuation token, so `-`, `/`, `&`
 * and `,` survive as context: "go-to-market" is go · - · to · - · market.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const chars = Array.from(text);
  // Offsets are in UTF-16 code units so they slice the original string correctly.
  const offsets: number[] = [];
  let offset = 0;
  for (const ch of chars) {
    offsets.push(offset);
    offset += ch.length;
  }
  offsets.push(offset);

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (SPACE.test(ch)) {
      i += 1;
      continue;
    }
    const startsWord = isWordChar(ch) || (ch === '.' && isWordChar(chars[i + 1]) && !isWordChar(chars[i - 1]));
    if (!startsWord) {
      tokens.push({ key: ch.toLowerCase(), raw: ch, kind: 'punct', start: offsets[i]!, end: offsets[i + 1]! });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < chars.length) {
      const c = chars[j]!;
      if (isWordChar(c)) j += 1;
      else if (c === '.' && isWordChar(chars[j + 1])) j += 1;
      else break;
    }
    while (j < chars.length && (chars[j] === '+' || chars[j] === '#')) j += 1;
    const raw = text.slice(offsets[i]!, offsets[j]!);
    tokens.push({ key: raw.toLowerCase(), raw, kind: 'word', start: offsets[i]!, end: offsets[j]! });
    i = j;
  }
  return tokens;
}

/** The token keys of a phrase, for building and querying tries. */
export function keysOf(text: string): string[] {
  return tokenize(text).map((token) => token.key);
}

/** Words only, lower-cased: what pasted-text detection and word counts read. */
export function wordKeys(text: string): string[] {
  return tokenize(text)
    .filter((token) => token.kind === 'word')
    .map((token) => token.key);
}

/** Number of words in a text. */
export function wordCount(text: string): number {
  return wordKeys(text).length;
}

/** A loose, comparable key for a phrase: its token keys joined by single spaces. */
export function phraseKey(text: string): string {
  return keysOf(text).join(' ');
}

/** Character ranges, end exclusive. */
export interface Range {
  start: number;
  end: number;
}

export function insideAny(start: number, end: number, ranges: readonly Range[]): boolean {
  return ranges.some((range) => start >= range.start && end <= range.end);
}

/**
 * Ranges of `text` copied from `source`: runs of at least `minWords` consecutive words that appear
 * in the same order in the source (G16: text pasted from the JD earns nothing). Case and
 * punctuation are ignored; the ranges point into `text`.
 */
export function copiedRanges(text: string, source: string, minWords = 8): Range[] {
  const sourceWords = wordKeys(source);
  if (sourceWords.length < minWords) return [];
  const shingles = new Set<string>();
  for (let i = 0; i + minWords <= sourceWords.length; i += 1) {
    shingles.add(sourceWords.slice(i, i + minWords).join(' '));
  }
  const words = tokenize(text).filter((token) => token.kind === 'word');
  const covered: boolean[] = new Array<boolean>(words.length).fill(false);
  for (let i = 0; i + minWords <= words.length; i += 1) {
    const shingle = words
      .slice(i, i + minWords)
      .map((word) => word.key)
      .join(' ');
    if (shingles.has(shingle)) for (let k = i; k < i + minWords; k += 1) covered[k] = true;
  }
  const ranges: Range[] = [];
  let open: Range | null = null;
  words.forEach((word, index) => {
    if (covered[index]) {
      if (open) open.end = word.end;
      else open = { start: word.start, end: word.end };
    } else if (open) {
      ranges.push(open);
      open = null;
    }
  });
  if (open) ranges.push(open);
  return ranges;
}

/** Sentences, split on . ! ? ; and line breaks, with their offsets. */
export function sentences(text: string): Range[] {
  const ranges: Range[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const boundary =
      ch === '\n' || ch === '!' || ch === '?' || ch === ';' || (ch === '.' && !isWordChar(text[i + 1]));
    if (boundary) {
      if (i > start) ranges.push({ start, end: i });
      start = i + 1;
    }
  }
  if (start < text.length) ranges.push({ start, end: text.length });
  return ranges.filter((range) => text.slice(range.start, range.end).trim().length > 0);
}
