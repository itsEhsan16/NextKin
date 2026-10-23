/**
 * The advisory writing lint (V2 §16.4, §7.12, §8.5; ImBackendImplementationPlan P8-08, old Q-07).
 * Tense, first-person pronouns, clichés, bullet length, repeated opening verbs, date consistency,
 * personal details a market forbids, length, and the market's spelling.
 *
 * Lint suggests; it never scores. The rubric does not import this file, and a test proves a
 * lint-only change (a spelling variant) leaves the score identical.
 */

import { compareCodePoints } from './bps';
import type { ScoringDocument } from './document';
import { spellingDifferences, type MarketProfile } from './markets';
import { phraseKey, tokenize, wordCount } from './text';

export type LintRule =
  | 'spelling'
  | 'first_person'
  | 'cliche'
  | 'bullet_length'
  | 'repeated_opening'
  | 'tense'
  | 'date_consistency'
  | 'personal_data'
  | 'length';

export interface LintSuggestion {
  id: string;
  rule: LintRule;
  message: string;
  field: 'headline' | 'summary' | 'bullet' | 'document';
  roleId?: string;
  bulletIndex?: number;
  replacement?: string;
}

export interface LintInput {
  document: ScoringDocument;
  market: MarketProfile;
  /** What the file itself carries (from the analyzer for an upload). */
  personal?: { photo?: boolean; dateOfBirth?: boolean; maritalStatus?: boolean };
  pages?: number;
}

const MAX_BULLET_WORDS = 30;
const FIRST_PERSON = new Set(['i', 'me', 'my', 'mine', 'myself']);
const CLICHES = [
  'team player', 'hard working', 'hard-working', 'results driven', 'results-driven', 'go getter', 'go-getter',
  'detail oriented', 'detail-oriented', 'think outside the box', 'synergy', 'self starter', 'self-starter',
  'dynamic individual', 'proven track record', 'responsible for',
];
const PRESENT_VERBS = new Set([
  'manage', 'lead', 'develop', 'design', 'build', 'create', 'drive', 'own', 'oversee', 'coordinate',
  'implement', 'maintain', 'support', 'run', 'deliver', 'launch', 'improve', 'mentor', 'write', 'test',
]);
const PERSONAL_PHRASES = ['date of birth', 'marital status', 'married', 'nationality', 'geburtsdatum', 'familienstand'];

function datesConsistent(doc: ScoringDocument): boolean {
  if (!doc.roles.every((r) => r.start && r.end !== undefined)) return doc.roles.length === 0;
  const precisions = new Set(doc.roles.flatMap((r) => [r.start, r.end]).flatMap((d) => (d ? [d.month === undefined] : [])));
  return precisions.size <= 1;
}

export function lint(input: LintInput): LintSuggestion[] {
  const { document: doc, market } = input;
  const out: LintSuggestion[] = [];
  const texts: { field: LintSuggestion['field']; text: string; roleId?: string; bulletIndex?: number }[] = [
    ...(doc.headline ? [{ field: 'headline' as const, text: doc.headline }] : []),
    ...(doc.summary ? [{ field: 'summary' as const, text: doc.summary }] : []),
    ...doc.roles.flatMap((role) => role.bullets.map((text, bulletIndex) => ({ field: 'bullet' as const, text, roleId: role.id, bulletIndex }))),
  ];

  for (const t of texts) {
    const where = t.roleId !== undefined ? `${t.roleId}:${t.bulletIndex}` : t.field;
    const at = { field: t.field, ...(t.roleId !== undefined ? { roleId: t.roleId, bulletIndex: t.bulletIndex } : {}) };
    for (const diff of spellingDifferences(t.text, market.spelling)) {
      out.push({ id: `spelling:${where}:${diff.start}`, rule: 'spelling', message: `${market.spelling} spells "${diff.word}" as "${diff.replacement}".`, replacement: diff.replacement, ...at });
    }
    const words = tokenize(t.text).filter((tok) => tok.kind === 'word');
    if (words.some((w) => FIRST_PERSON.has(w.key))) {
      out.push({ id: `first_person:${where}`, rule: 'first_person', message: 'Resumes leave out "I", "me" and "my".', ...at });
    }
    const key = ` ${phraseKey(t.text)} `;
    for (const cliche of CLICHES) {
      if (key.includes(` ${phraseKey(cliche)} `)) {
        out.push({ id: `cliche:${where}:${phraseKey(cliche)}`, rule: 'cliche', message: `"${cliche}" says little; show it with an example instead.`, ...at });
      }
    }
    if (t.field === 'bullet' && wordCount(t.text) > MAX_BULLET_WORDS) {
      out.push({ id: `bullet_length:${where}`, rule: 'bullet_length', message: `Keep a bullet under ${MAX_BULLET_WORDS} words.`, ...at });
    }
  }

  for (const role of doc.roles) {
    const openings = role.bullets.map((b) => tokenize(b).find((tok) => tok.kind === 'word')?.key ?? '');
    const counts = new Map<string, number>();
    for (const word of openings) if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const [word, count] of [...counts].sort((a, b) => compareCodePoints(a[0], b[0]))) {
      if (count >= 3) {
        out.push({ id: `repeated_opening:${role.id}:${word}`, rule: 'repeated_opening', message: `${count} bullets open with "${word}"; vary the verbs.`, field: 'bullet', roleId: role.id });
      }
    }
    if (role.end !== null && role.end !== undefined) {
      openings.forEach((word, bulletIndex) => {
        if (PRESENT_VERBS.has(word)) {
          out.push({ id: `tense:${role.id}:${bulletIndex}`, rule: 'tense', message: 'A past role reads in the past tense.', field: 'bullet', roleId: role.id, bulletIndex });
        }
      });
    }
  }

  if (!datesConsistent(doc)) {
    out.push({ id: 'date_consistency', rule: 'date_consistency', message: `Give every role a start and an end, written the same way (${market.dateFormat}).`, field: 'document' });
  }

  const personal = input.personal ?? {};
  const mentioned = texts.some((t) => PERSONAL_PHRASES.some((p) => ` ${phraseKey(t.text)} `.includes(` ${p} `)));
  const carries = { photo: personal.photo === true, date_of_birth: personal.dateOfBirth === true, marital_status: personal.maritalStatus === true };
  for (const item of market.forbidden) {
    if (carries[item]) out.push({ id: `personal_data:${item}`, rule: 'personal_data', message: `Leave the ${item.replace(/_/g, ' ')} off the resume.`, field: 'document' });
  }
  if (mentioned) out.push({ id: 'personal_data:text', rule: 'personal_data', message: 'Leave personal details (birth date, marital status, nationality) off the resume.', field: 'document' });

  if (input.pages !== undefined && input.pages > market.maxPages) {
    out.push({ id: 'length', rule: 'length', message: `Aim for ${market.maxPages} pages or fewer.`, field: 'document' });
  }

  return out.sort((a, b) => compareCodePoints(a.id, b.id));
}
