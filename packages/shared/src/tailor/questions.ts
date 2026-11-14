import type { PartialDate } from '@nextkin/engines/dates';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { findSkill, resolveSkill } from '@nextkin/engines/normalizer';
import { phraseIndex, phraseMentions } from '@nextkin/engines/phrases';

import type { KeywordQuestion, TailorKeyword, TailorPlace } from '../models/tailor';
import { placeCloseness, placeFitsEra, type FitPlace } from '../scoring/placeFit';

/**
 * "Did you use this here?" (owner, 2026-11-15; toreview §206.3). A keyword the job asks for that
 * the resume does not show may still be something the candidate did: the line about building REST
 * endpoints was written without naming Postman. A question is put beside that line, and only a
 * "yes" makes it a fact, as the candidate's own word (D-14, G13). "No", or no answer, adds nothing.
 *
 * Two sources propose, and code decides both the same way (G14):
 * - the rules: a place the comparison already picked for the keyword (§163), with the line of it
 *   that is closest to the keyword;
 * - a model, which only ever returns three things for code to check: a keyword from the list it
 *   was given, a place id, a line number. It writes no words the candidate reads.
 * A question is kept only when the keyword is a real gap of this job, the place and line exist,
 * the line does not already name it, and the technology existed while the role ran.
 */

export const MAX_QUESTIONS = 8;
const PER_PLACE = 3;

export type QuestionContext = {
  keywords: readonly TailorKeyword[];
  places: readonly TailorPlace[];
  fitPlaces: readonly FitPlace[];
  picks?: Readonly<Record<string, readonly string[]>>;
  asOf?: PartialDate;
};

/** A place's own lines, as the model is shown them: the title line left out. */
export const placeLines = (place: FitPlace): string[] => place.text.split('\n').slice(1).map((line) => line.trim()).filter(Boolean);

/** The gaps a question may be about: missing, a skill, and not already backed by a record. */
export const askable = (keywords: readonly TailorKeyword[]): TailorKeyword[] =>
  keywords.filter((k) => !k.onResume && k.kind !== 'soft' && !k.elsewhere?.where);

function names(text: string, keyword: string): boolean {
  const ref = resolveSkill(TAXONOMY, keyword);
  return ref.known ? findSkill(TAXONOMY, text, ref).length > 0 : phraseMentions(text, phraseIndex([ref.id])).length > 0;
}

/** One proposal, checked: the question it becomes, or null when it does not hold. */
function checked(ctx: QuestionContext, proposal: { keyword: string; where: string; line: number }, by: KeywordQuestion['by']): KeywordQuestion | null {
  const keyword = askable(ctx.keywords).find((k) => k.label.toLowerCase() === proposal.keyword.trim().toLowerCase());
  const place = ctx.fitPlaces.find((p) => p.id === proposal.where);
  const label = ctx.places.find((p) => p.id === proposal.where)?.label;
  if (!keyword || !place || !label) return null;
  const line = Number.isInteger(proposal.line) ? placeLines(place)[proposal.line] : undefined;
  if (!line || names(line, keyword.label)) return null;
  if (!placeFitsEra(place, keyword.label, ctx.asOf)) return null;
  return { keyword: keyword.label, where: place.id, place: label, line: line.slice(0, 300), by };
}

/** The line of a picked place that sits closest to the keyword, when one does. */
function closestLine(place: FitPlace, keyword: string): number {
  let best = -1;
  let score = 0;
  placeLines(place).forEach((line, index) => {
    const s = placeCloseness({ id: place.id, text: line, skills: [] }, keyword);
    if (s > score) [best, score] = [index, s];
  });
  return best;
}

/** At most one question a keyword, a few a place, the job's top keywords first. */
function limit(ctx: QuestionContext, questions: readonly KeywordQuestion[]): KeywordQuestion[] {
  const top = new Set(ctx.keywords.filter((k) => k.top).map((k) => k.label));
  const perPlace = new Map<string, number>();
  const seen = new Set<string>();
  const out: KeywordQuestion[] = [];
  for (const q of [...questions].sort((a, b) => Number(top.has(b.keyword)) - Number(top.has(a.keyword)))) {
    if (seen.has(q.keyword) || (perPlace.get(q.where) ?? 0) >= PER_PLACE) continue;
    seen.add(q.keyword);
    perPlace.set(q.where, (perPlace.get(q.where) ?? 0) + 1);
    out.push(q);
    if (out.length === MAX_QUESTIONS) break;
  }
  return out;
}

/** The rules' questions: each picked place, with the line that hints at the keyword. */
export function ruleQuestions(ctx: QuestionContext): KeywordQuestion[] {
  const out: KeywordQuestion[] = [];
  for (const keyword of askable(ctx.keywords)) {
    const where = ctx.picks?.[keyword.label]?.[0];
    const place = where ? ctx.fitPlaces.find((p) => p.id === where) : undefined;
    if (!place) continue;
    const line = closestLine(place, keyword.label);
    const question = line >= 0 ? checked(ctx, { keyword: keyword.label, where: place.id, line }, 'rules') : null;
    if (question) out.push(question);
  }
  return limit(ctx, out);
}

/**
 * The questions shown: the rules' first, then the model's proposals that pass the same checks and
 * ask about a keyword the rules did not.
 */
export function keywordQuestions(ctx: QuestionContext, proposals: readonly { keyword: string; where: string; line: number }[] = []): KeywordQuestion[] {
  const rules = ruleQuestions(ctx);
  const model = proposals.map((p) => checked(ctx, p, 'model')).filter((q): q is KeywordQuestion => q !== null);
  return limit(ctx, [...rules, ...model]);
}

/** The question as the candidate reads it. Code writes it; the line under it is their own. */
export const questionText = (q: Pick<KeywordQuestion, 'keyword' | 'place'>): string => `Did you use ${q.keyword} in ${q.place}?`;
