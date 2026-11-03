import type { JdFact, JdIssue, JdQuote, JdStructured, PayStatement } from '../models/jdStructured';
import { parsePay, parseYears } from './jdParse';

/**
 * The checks code runs over a reading (toreview §153): duplicates merged, pay and years read from
 * their quotes, and every place the posting disagrees with itself flagged — never silently
 * resolved. Pure, so each rule has a test.
 */

/** Same words, case and punctuation aside. */
export const factKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The most places one fact keeps: enough to show it was repeated, bounded for storage. */
export const MAX_QUOTES = 12;

/** Joins quotes, each place once, in the order the posting says them. */
export function unionQuotes(a: readonly JdQuote[], b: readonly JdQuote[]): JdQuote[] {
  const out = [...a];
  for (const q of b) if (!out.some((o) => o.start === q.start && o.end === q.end)) out.push(q);
  return out.sort((x, y) => x.start - y.start).slice(0, MAX_QUOTES);
}

/**
 * One fact per meaning: facts with the same key (the same words, case and punctuation aside, or the
 * same parsed value) become one that keeps every quote. Returns the facts and how many merged.
 */
export function mergeFacts<F extends JdFact<unknown>>(
  facts: readonly F[],
  key: (fact: F) => string,
): { facts: F[]; merged: number } {
  const out: F[] = [];
  let merged = 0;
  for (const fact of facts) {
    const k = key(fact);
    // By meaning only: two skills named in one line are two facts, not one.
    const twin = out.find((o) => key(o) === k);
    if (twin) {
      twin.quotes = unionQuotes(twin.quotes, fact.quotes);
      if (fact.status === 'unclear') twin.status = 'unclear';
      merged += 1;
    } else out.push({ ...fact, quotes: [...fact.quotes] });
  }
  return { facts: out, merged };
}

const money = (p: PayStatement) =>
  `${p.currency ?? ''}${p.min ?? ''}-${p.max ?? ''}/${p.period ?? ''}`;

const RANK: Record<PayStatement['component'], number> = {
  base: 0,
  fixed: 0,
  total: 1,
  unknown: 2,
  variable: 3,
  incentive: 3,
  bonus: 3,
};

/** "₹45,000 – ₹80,000 a month", as a note quotes it. */
export function payText(p: PayStatement): string {
  // Lakh grouping for rupees (45,000 · 4,50,000), thousands for everything else.
  const fmt = (n: number) => n.toLocaleString(p.currency === 'INR' ? 'en-IN' : 'en-US');
  const sym: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const c = p.currency ? (sym[p.currency] ?? `${p.currency} `) : '';
  const amount =
    p.min !== undefined && p.max !== undefined && p.min !== p.max
      ? `${c}${fmt(p.min)}–${c}${fmt(p.max)}`
      : `${c}${fmt(p.min ?? p.max ?? 0)}`;
  return p.period ? `${amount} a ${p.period}` : amount;
}

/**
 * Pay, read from its lines. Lines with the same figures are one statement (the more specific label
 * wins: "fixed" over unknown). A line without a currency or period takes the one every other line
 * agrees on. The range is shown only when all statements agree; otherwise it is the base line,
 * marked unclear, and an issue names each figure — no fixed/variable split is invented.
 */
export function readPay(
  lines: readonly { component: PayStatement['component']; quote: JdQuote }[],
): { compensation: JdStructured['compensation']; issues: JdIssue[]; merged: number } {
  const parsed: JdFact<PayStatement>[] = [];
  for (const line of lines) {
    const pay = parsePay(line.quote.text, line.component);
    if (pay) parsed.push({ value: pay, quotes: [line.quote], status: 'stated' });
  }
  const agreed = <K extends 'currency' | 'period'>(k: K) => {
    const seen = [...new Set(parsed.map((p) => p.value[k]).filter(Boolean))];
    return seen.length === 1 ? seen[0] : undefined;
  };
  const currency = agreed('currency');
  const period = agreed('period');
  for (const p of parsed) {
    if (!p.value.currency && currency) p.value.currency = currency;
    if (!p.value.period && period) {
      p.value.period = period;
      p.status = 'interpreted';
    }
  }
  const statements: JdFact<PayStatement>[] = [];
  let merged = 0;
  for (const p of parsed) {
    const twin = statements.find((s) => money(s.value) === money(p.value));
    if (!twin) {
      statements.push(p);
      continue;
    }
    twin.quotes = unionQuotes(twin.quotes, p.quotes);
    if (RANK[p.value.component] < RANK[twin.value.component])
      twin.value.component = p.value.component;
    merged += 1;
  }
  const issues: JdIssue[] = [];
  if (statements.length === 0) return { compensation: { statements }, issues, merged };
  const base = [...statements].sort(
    (a, b) => RANK[a.value.component] - RANK[b.value.component],
  )[0]!;
  if (statements.length === 1) {
    return { compensation: { statements, range: { ...base } }, issues, merged };
  }
  const describe = (s: JdFact<PayStatement>) =>
    s.value.component === 'unknown'
      ? payText(s.value)
      : `${payText(s.value)} (${s.value.component})`;
  issues.push({
    kind: 'ambiguous',
    field: 'compensation',
    note: `The listing gives pay more than one way: ${statements.map(describe).join('; ')}. It doesn’t say how they relate.`,
    quotes: statements.flatMap((s) => s.quotes),
    by: 'rules',
  });
  return {
    compensation: { statements, range: { ...base, status: 'unclear' } },
    issues,
    merged,
  };
}

/**
 * Years, read from the posting's experience lines. Two different asks, or "freshers can apply"
 * beside a minimum of a year or more, is a conflict: both are kept and the page says so.
 */
export function readExperience(lines: readonly JdFact[]): {
  experience: Omit<JdStructured['experience'], 'lines'>;
  issues: JdIssue[];
} {
  const asks: { min: number; max?: number; quote: JdQuote }[] = [];
  let freshers: JdFact<boolean> | undefined;
  for (const line of lines) {
    for (const quote of line.quotes) {
      const years = parseYears(quote.text);
      if (!years) continue;
      if (years.min !== undefined)
        asks.push({
          min: years.min,
          ...(years.max !== undefined ? { max: years.max } : {}),
          quote,
        });
      if (years.freshersOk)
        freshers = freshers
          ? { ...freshers, quotes: unionQuotes(freshers.quotes, [quote]) }
          : { value: true, quotes: [quote], status: 'stated' };
    }
  }
  const issues: JdIssue[] = [];
  const distinct = [...new Map(asks.map((a) => [`${a.min}-${a.max ?? ''}`, a])).values()];
  const first = distinct[0];
  const conflict = distinct.length > 1;
  if (conflict) {
    issues.push({
      kind: 'conflict',
      field: 'experience',
      note: `The listing asks for different experience in different places: ${distinct
        .map((a) => (a.max !== undefined ? `${a.min}–${a.max} years` : `${a.min}+ years`))
        .join(' and ')}.`,
      quotes: distinct.map((a) => a.quote),
      by: 'rules',
    });
  }
  if (freshers && first && first.min >= 1) {
    issues.push({
      kind: 'conflict',
      field: 'experience',
      note: `The listing asks for at least ${first.min} year${first.min === 1 ? '' : 's'} of experience, and also says freshers can apply.`,
      quotes: [first.quote, ...freshers.quotes],
      by: 'rules',
    });
    freshers = { ...freshers, status: 'unclear' };
  }
  const status = conflict || (freshers && first && first.min >= 1) ? 'unclear' : 'stated';
  const quotes = first ? asks.filter((a) => a.min === first.min).map((a) => a.quote) : [];
  return {
    experience: {
      ...(first ? { minYears: { value: first.min, quotes, status } } : {}),
      ...(first?.max !== undefined ? { maxYears: { value: first.max, quotes, status } } : {}),
      ...(freshers ? { freshersOk: freshers } : {}),
    },
    issues,
  };
}

/** Sensitive eligibility the posting states: shown as written, with a neutral note. */
export const SENSITIVE =
  /\b(?:age|aged|years? old|male|female|gender|married|unmarried|marital|religion|caste|nationality|height|weight|photo)\b/i;
