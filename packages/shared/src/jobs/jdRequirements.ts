import type {
  EligibilityKind as LedgerEligibility,
  JdStated,
  StatedEligibility,
} from '@nextkin/engines/requirements';

import type { JdFact, JdStructured } from '../models/jdStructured';

/**
 * What the structured reading states, in the shape the requirement ledger takes (toreview §206.2).
 *
 * Before this the reading and the ledger each read the posting on their own: the reading placed
 * years, languages, education and conditions with their quotes, and the ledger then looked for
 * the same things again in the raw text with a handful of phrases. The two could disagree, and
 * what the reading found (a degree, a certificate, a language it had quoted) never reached the
 * comparison at all. Here the reading is the one source: its facts become the ledger's
 * requirements, each still pointing at the words it came from.
 *
 * Nothing here moves points. Years asked for a skill sharpen that skill's own credit, exactly as
 * the ledger already did from the raw text; everything else is an eligibility line, reported as
 * "check you meet this" and never scored (V2 §7.8, G15).
 */

const YEARS = /(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*\d{0,2}\s*\+?\s*(?:years?|yrs?|jahre|jahren)(?![\p{L}])/iu;
/** A licence or certificate, as opposed to a degree. */
const CERTIFICATE =
  /\b(?:certif\w*|licen[cs]e\w*|accredit\w*|chartered|registered (?:nurse|engineer)|pmp|cissp|cfa|cpa|itil|scrum ?master|csm|prince2|six sigma)\b/i;

const spanOf = (fact: JdFact<unknown>) => {
  const quote = fact.quotes[0];
  return quote ? { span: { start: quote.start, end: quote.end } } : {};
};

/** The posting's own words for a fact: its quote, else the value the reading kept. */
const wordsOf = (fact: JdFact<unknown>, fallback: string): string =>
  (fact.quotes[0]?.text ?? fallback).trim().slice(0, 300);

const key = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, ' ').trim();

/**
 * Years a posting asks for one skill, read from the line that names it: "3+ years of React" ties
 * the 3 to React, and "4 years of Java and Spring" to both. The skill must sit in the same clause
 * as the number, after it: in "5 years in logistics, some Kafka" the years are for logistics, and
 * Kafka is asked with none. Erring this way under-asks rather than inventing a bar the posting
 * did not set.
 */
function skillYearsOf(s: JdStructured): Record<string, number> {
  const out: Record<string, number> = {};
  for (const skill of s.skills) {
    if (skill.category === 'soft') continue;
    for (const quote of skill.quotes) {
      const match = YEARS.exec(quote.text);
      if (!match) continue;
      const clause = quote.text.slice(match.index + match[0].length).split(/[,;:(]|\s[-–—]\s/)[0] ?? '';
      const after = key(clause);
      if (!` ${after} `.includes(` ${key(skill.value)} `)) continue;
      out[skill.value] = Math.max(out[skill.value] ?? 0, Number(match[1]));
      break;
    }
  }
  return out;
}

const CONDITION: Partial<Record<JdStructured['eligibility'][number]['kind'], LedgerEligibility>> = {
  work_authorization: 'work_authorization',
  location: 'location',
  background_check: 'other',
  other: 'other',
};

export function statedOf(s: JdStructured): JdStated {
  const eligibility: StatedEligibility[] = [];
  for (const fact of s.education) {
    eligibility.push({
      kind: CERTIFICATE.test(fact.value) ? 'certification' : 'education',
      text: wordsOf(fact, fact.value),
      importance: fact.importance,
      ...spanOf(fact),
    });
  }
  for (const fact of s.languages) {
    eligibility.push({
      kind: 'language',
      text: wordsOf(fact, fact.value),
      importance: fact.importance,
      ...spanOf(fact),
    });
  }
  for (const fact of s.eligibility) {
    // Conditions on age, gender and the like are shown on the job's page with a caution; they
    // are never turned into something for the candidate to "meet".
    const kind = fact.sensitive ? undefined : CONDITION[fact.kind];
    if (kind) eligibility.push({ kind, text: wordsOf(fact, fact.value), ...spanOf(fact) });
  }
  return { skillYears: skillYearsOf(s), eligibility };
}

/** The years of experience a posting asks overall, as a listing states them. */
export function statedYearsOf(s: JdStructured): { min: number; max: number } | undefined {
  const min = s.experience.minYears?.value;
  if (min === undefined) return undefined;
  return { min, max: Math.max(min, s.experience.maxYears?.value ?? min) };
}

/** Whether the posting names a licence or certificate among its education lines. */
export const certificatesOf = (s: JdStructured): JdStructured['education'] =>
  s.education.filter((fact) => CERTIFICATE.test(fact.value));
