import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { isQuantified } from '@nextkin/engines/quantified';

import type { GenerationInput } from '../models/generation';
import type { TailorComparison, TailorConfirmation, TailorExperienceDepth, TailorFigure, TailorFix, TailorKeyword } from '../models/tailor';
import type { FixPlan } from '../scoring/fixPlan';

export type { FixPlan, PlanStep } from '../scoring/fixPlan';

/**
 * The one "Customize" screen of the job → resume flow (toreview §114, owner 2026-10-19), as pure
 * state both apps render: which parts to improve (all on), how deep into the work history, the
 * keywords the user taps, and where any of them was used. The run it starts is built here too, so
 * web and mobile ask the server for exactly the same thing.
 */

export const CUSTOMIZE_FIXES: readonly TailorFix[] = ['headline', 'summary', 'skills', 'experience', 'projects', 'length'];

/**
 * Where a tapped keyword was used: one or more roles or projects (owner, toreview §163). `by: 'ai'`
 * is the set the comparison picked, untouched; any edit makes it the user's own (`'you'`).
 */
export type KeywordPlace = { where: readonly string[]; note: string; by?: 'ai' | 'you' };

export type CustomizeChoices = {
  fixes: readonly TailorFix[];
  experience: TailorExperienceDepth;
  /** Keywords the user tapped (missing ones), and any they typed in. */
  added: readonly string[];
  /** Where a tapped keyword was used, by its label (optional: without it, Skills only). */
  places: Readonly<Record<string, KeywordPlace>>;
  /** Bullets rewritten with their real result, by `figureKey` (toreview §129). */
  figures?: Readonly<Record<string, string>>;
};

/** A bullet's key in `figures`: its role and its line in the base resume. */
export const figureKey = (roleId: string, line: number) => `${roleId}#${line}`;

/** Whether a rewritten bullet states a result the score counts: the achievements check itself. */
export const statesResult = (text: string): boolean => isQuantified(text, TAXONOMY);

/**
 * "About 8.7/10 after this" (toreview §129): the AI's own steps, plus each of your steps you have
 * answered, at the gain the path measured for it. The score is linear in these answers (a
 * requirement's credit, a share of bullets, a count of sections), so the sum is the re-score up to
 * rounding; the run pins the exact figure when it starts. A tick without a place earns the listed
 * half of a keyword (D-14); a figure counts once it states a result.
 */
export function projectedScore(plan: FixPlan | undefined, c: CustomizeChoices): number | undefined {
  if (!plan?.target) return undefined;
  let total = plan.target.ai;
  for (const s of plan.steps) {
    if (s.who !== 'you' || s.worth === null) continue;
    const placed = s.keyword !== undefined && c.added.includes(s.keyword) && (c.places[s.keyword]?.where.length ?? 0) > 0;
    if (s.kind === 'keyword' && s.keyword && c.added.includes(s.keyword)) total += placed ? s.worth : s.worth / 2;
    else if (s.kind === 'evidence' && placed) total += s.worth;
    else if (s.kind === 'number' && s.bullet) {
      const text = c.figures?.[figureKey(s.bullet.roleId, s.bullet.index)];
      if (text && statesResult(text)) total += s.worth;
    }
  }
  return Math.min(10, Math.round(total * 10) / 10);
}

/** The plan's headline (toreview §129): how many steps reach the goal, or the honest ceiling. */
export function planGoalLine(plan: FixPlan): string {
  const { steps, target } = plan;
  if (!target)
    return steps.length === 0
      ? 'Nothing measured is missing'
      : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} to improve`;
  if (target.steps === 0) return `Already above ${target.goal.toFixed(1)}`;
  if (target.reaches && target.steps !== null) {
    const after = steps[target.steps - 1]?.totalAfter ?? target.goal;
    return `${target.steps} ${target.steps === 1 ? 'step' : 'steps'} to reach ${after.toFixed(1)}/10`;
  }
  return `Best possible for this job: ${target.ceiling.toFixed(1)}/10`;
}

/** Only years the roles don't show keep this plan from its goal, and nothing honest adds those. */
export const shortOnYears = (plan: FixPlan): boolean =>
  plan.target?.reaches === false && plan.steps.some((s) => s.kind === 'years' && s.who === 'nobody');

export function setFigure(c: CustomizeChoices, roleId: string, line: number, text: string | null): CustomizeChoices {
  const figures = { ...(c.figures ?? {}) };
  if (text && text.trim()) figures[figureKey(roleId, line)] = text;
  else delete figures[figureKey(roleId, line)];
  return { ...c, figures };
}

/** Everything on, the whole history, nothing tapped: the user adds, never the default (D-14). */
export const initialChoices = (): CustomizeChoices => ({ fixes: CUSTOMIZE_FIXES, experience: 'full', added: [], places: {} });

export function toggleKeyword(c: CustomizeChoices, label: string, on: boolean): CustomizeChoices {
  const has = c.added.includes(label);
  if (on === has) return c;
  if (on) return { ...c, added: [...c.added, label] };
  const places = { ...c.places };
  delete places[label];
  return { ...c, added: c.added.filter((l) => l !== label), places };
}

/**
 * A keyword ticked or unticked. A tick takes the places the comparison picked for it, as the AI's
 * (toreview §163); a keyword with none is a skills-list tick only.
 */
export function tickKeyword(c: CustomizeChoices, label: string, on: boolean, picks?: Readonly<Record<string, readonly string[]>>): CustomizeChoices {
  const next = toggleKeyword(c, label, on);
  const where = on ? picks?.[label] : undefined;
  return where?.length ? setPlace(next, label, { where, note: '', by: 'ai' }) : next;
}

/** "Select all" over the shown keywords; again, "Clear all" (owner, toreview §113). */
export function toggleAll(c: CustomizeChoices, labels: readonly string[], picks?: Readonly<Record<string, readonly string[]>>): CustomizeChoices {
  const allOn = labels.length > 0 && labels.every((l) => c.added.includes(l));
  return labels.reduce((next, label) => tickKeyword(next, label, !allOn, picks), c);
}

/** A keyword's places replaced; none left drops the entry (Skills only). */
export function setPlace(c: CustomizeChoices, label: string, place: KeywordPlace | null): CustomizeChoices {
  const places = { ...c.places };
  if (place?.where.length) places[label] = { ...place, where: [...new Set(place.where)] };
  else delete places[label];
  return { ...c, places };
}

/** One place switched on or off for a ticked keyword: the set is the user's from then on. */
export function togglePlace(c: CustomizeChoices, label: string, where: string, on: boolean): CustomizeChoices {
  const now = c.places[label]?.where ?? [];
  const next = on ? [...now, where] : now.filter((w) => w !== where);
  const ticked = on && !c.added.includes(label) ? { ...c, added: [...c.added, label] } : c;
  return setPlace(ticked, label, { where: next, note: c.places[label]?.note ?? '', by: 'you' });
}

export function setFix(c: CustomizeChoices, fix: TailorFix, on: boolean): CustomizeChoices {
  const fixes = on ? [...new Set([...c.fixes, fix])] : c.fixes.filter((f) => f !== fix);
  return { ...c, fixes: CUSTOMIZE_FIXES.filter((f) => fixes.includes(f)) };
}

/** The screen's keyword rows: the top missing skills, the soft skills, then the rest. */
export function keywordGroups(comparison: TailorComparison): { top: TailorKeyword[]; soft: TailorKeyword[]; more: TailorKeyword[] } {
  const missing = comparison.keywords.filter((k) => !k.onResume);
  const ranked = missing.some((k) => k.top);
  return {
    top: missing.filter((k) => k.kind !== 'soft' && (!ranked || k.top)),
    soft: missing.filter((k) => k.kind === 'soft'),
    more: ranked ? missing.filter((k) => k.kind !== 'soft' && !k.top) : [],
  };
}

/** The keywords the resume already shows, of the ones the screen counts (the top ones). */
export function shownKeywords(comparison: TailorComparison): TailorKeyword[] {
  const skills = comparison.keywords.filter((k) => k.kind !== 'soft');
  return skills.some((k) => k.top) ? skills.filter((k) => k.top) : skills;
}

/** Nothing to run: every part switched off and no keyword tapped. */
export const nothingChosen = (c: CustomizeChoices) => c.fixes.length === 0 && c.added.length === 0;

/** The run "Create my resume" starts: the comparison's JD and resume, and these choices. */
export function tailorRunInput(comparison: TailorComparison, c: CustomizeChoices, jobId?: string): GenerationInput {
  const missing = comparison.keywords.filter((k) => !k.onResume).map((k) => k.label);
  // One confirmation per place (toreview §163); the server reads each the same way.
  const confirmed: TailorConfirmation[] = c.added.flatMap((keyword) => {
    const place = c.places[keyword];
    return [...new Set(place?.where ?? [])].map((where) => ({ keyword, where, ...(place!.note.trim() ? { note: place!.note.trim() } : {}), ...(place!.by ? { by: place!.by } : {}) }));
  });
  const figures: TailorFigure[] = Object.entries(c.figures ?? {}).flatMap(([key, text]) => {
    const at = key.lastIndexOf('#');
    const line = Number(key.slice(at + 1));
    return at > 0 && Number.isInteger(line) && text.trim() ? [{ where: key.slice(0, at), line, text: text.trim() }] : [];
  });
  return {
    kind: 'resume',
    jdId: comparison.jdId,
    ...(jobId ? { jobId } : {}),
    baseResumeId: comparison.resumeId,
    tailor: {
      sourceResumeId: comparison.resumeId,
      baselineScore: comparison.score,
      ...(comparison.pageCount != null ? { sourcePages: comparison.pageCount } : {}),
      added: [...c.added],
      skipped: missing.filter((label) => !c.added.includes(label)),
      fixes: [...c.fixes],
      experience: c.experience,
      ...(confirmed.length ? { confirmed } : {}),
      ...(figures.length ? { figures } : {}),
    },
  };
}
