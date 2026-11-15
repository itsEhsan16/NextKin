import { readFileSync } from 'node:fs';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { isQuantified } from '@nextkin/engines/quantified';

import { analyzePdf } from '../src/parsing/pdf';

/**
 * The coverage check (owner, D-25, toreview §211): our stand-in for an outside resume checker. It
 * reads a finished PDF the way one does, as the plain text in the file, and says for one job:
 * - which of the job's phrases the text contains, letter for letter (case and spacing aside);
 * - whether the job's title is there as the posting wrote it;
 * - how many lines state a measured result (five is the bar);
 * - whether any hyphen came out as a look-alike a checker reads as a different character.
 *
 * It is deliberately stricter than our own score, which knows "Postgres" is "PostgreSQL": a
 * checker does not, so a phrase counts here only as the job spelled it.
 *
 * `pnpm --filter @nextkin/server exec tsx evals/coverage.ts resume.pdf phrases.txt "Job title"`,
 * with one phrase per line in the text file.
 */

export const RESULTS_WANTED = 5;

/** Lower case, one space between words; hyphens and every other character kept as they are. */
const plain = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** A phrase as whole words in the text: "Java" is not found in "JavaScript". */
function contains(text: string, phrase: string): boolean {
  const needle = plain(phrase);
  if (!needle) return false;
  const hay = plain(text);
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = hay[at - 1];
    const after = hay[at + needle.length];
    if (!/[\p{L}\p{N}]/u.test(before ?? ' ') && !/[\p{L}\p{N}]/u.test(after ?? ' ')) return true;
  }
  return false;
}

export interface Coverage {
  phrases: { phrase: string; found: boolean }[];
  found: number;
  total: number;
  /** Null when no title was given. */
  titleFound: boolean | null;
  results: number;
  /** HYPHEN, NON-BREAKING HYPHEN and SOFT HYPHEN in the text: each reads as a different word. */
  oddHyphens: number;
  /** Every phrase and the title found, enough results, no odd hyphen. */
  pass: boolean;
}

export function coverageOf(args: { text: string; phrases: readonly string[]; title?: string }): Coverage {
  // Each phrase once, as it was first spelled.
  const first = new Map<string, string>();
  for (const p of args.phrases) if (p.trim() && !first.has(plain(p))) first.set(plain(p), p.trim());
  const wanted = [...first.values()];
  const phrases = wanted.map((phrase) => ({ phrase, found: contains(args.text, phrase) }));
  const found = phrases.filter((p) => p.found).length;
  const titleFound = args.title?.trim() ? plain(args.text).includes(plain(args.title)) : null;
  const results = args.text.split(/\r?\n/).filter((line) => isQuantified(line, TAXONOMY)).length;
  const oddHyphens = (args.text.match(/[‐‑­]/g) ?? []).length;
  return { phrases, found, total: phrases.length, titleFound, results, oddHyphens, pass: found === phrases.length && titleFound !== false && results >= RESULTS_WANTED && oddHyphens === 0 };
}

/** The report as lines a person reads. */
export function coverageLines(c: Coverage): string[] {
  return [
    `Keywords: ${c.found} of ${c.total} found`,
    ...c.phrases.filter((p) => !p.found).map((p) => `  missing: ${p.phrase}`),
    ...(c.titleFound === null ? [] : [`Job title: ${c.titleFound ? 'found as written' : 'NOT found as written'}`]),
    `Measured results: ${c.results} (wanted ${RESULTS_WANTED})`,
    `Look-alike hyphens: ${c.oddHyphens}`,
    c.pass ? 'PASS' : 'FAIL',
  ];
}

async function main() {
  const [pdfPath, phrasesPath, title] = process.argv.slice(2);
  if (!pdfPath || !phrasesPath) {
    console.error('usage: tsx evals/coverage.ts <resume.pdf> <phrases.txt> ["Job title"]');
    process.exitCode = 2;
    return;
  }
  const { text } = await analyzePdf(new Uint8Array(readFileSync(pdfPath)));
  const phrases = readFileSync(phrasesPath, 'utf8').split(/\r?\n/);
  const report = coverageOf({ text, phrases, ...(title ? { title } : {}) });
  for (const line of coverageLines(report)) console.log(line);
  if (!report.pass) process.exitCode = 1;
}

if (process.argv[1] && /coverage\.ts$/.test(process.argv[1])) void main();
