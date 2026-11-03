/**
 * The path to a target score (toreview §129, owner 2026-10-21: "if its recommendation is followed,
 * the resume reaches at least 8.5").
 *
 * The fixes engine prices each fix alone; added up, those prices overstate, because the keyword
 * part is a weighted average and section checks share a component. This engine applies the steps
 * **cumulatively** and re-scores the whole edited input after each one, so every step's gain is
 * what it adds after the ones before it, and the last total is exactly what a full re-score of the
 * edited document gives (G14, G17: no estimate anywhere).
 *
 * Every step is something real (G16): the user confirms a skill they used in a dated role, writes
 * the real figure into a bullet, completes a section, resolves a timeline flag; or the AI fixes
 * what it can on its own (the caller says which checks those are). A skill is never assumed: a
 * `confirm_skill` step simulates the user saying "yes, at this role", and is theirs to accept.
 * Weights are never touched. When even every step falls short of the target, the ceiling is the
 * truth and the blockers say why ("8 years of Go asked; your roles show 3").
 */

import { compareCodePoints, type Bps } from './bps';
import type { ScoringDocument } from './document';
import { bestRoleFor } from './placement';
import { canCarryResult, isQuantified } from './quantified';
import type { Importance } from './requirements';
import { scoreCore, type Assumptions, type FormatCheckId, type ScoreInput, type ScoreResult, type SectionCheckId } from './rubric';

export type PathAction =
  | { type: 'confirm_skill'; requirementId: string; skillName: string; importance: Importance; roleId: string | null; from: 'gap' | 'listed' }
  | { type: 'add_figure'; roleId: string; bulletIndex: number; text: string }
  | { type: 'pass_section'; check: SectionCheckId }
  | { type: 'pass_format'; check: FormatCheckId }
  | { type: 'resolve_timeline'; roleId: string; skillId: string; skillName: string };

export interface PathStep {
  id: string;
  action: PathAction;
  who: 'ai' | 'you';
  /** What this step adds after every step before it. */
  gainBps: Bps;
  /** The total once this step and every one before it is done. */
  totalAfterBps: Bps;
}

export type PathBlocker = { type: 'years_short'; requirementId: string; skillName: string; askedYears: number; shownMonths: number };

export interface TargetPath {
  targetBps: Bps;
  startBps: Bps;
  /** The total after the AI's own steps only. */
  aiBps: Bps;
  steps: PathStep[];
  /** The total with every step done: the most this resume can honestly reach for this job. */
  ceilingBps: Bps;
  reachesTarget: boolean;
  /** How many steps, from the first, reach the target; 0 when already there, null when never. */
  stepsToTarget: number | null;
  blockers: PathBlocker[];
}

export interface TargetPathOptions {
  targetBps: Bps;
  /** Checks the AI satisfies on its own: the template's formatting, a summary written from facts. */
  aiCan?: { format?: readonly FormatCheckId[]; sections?: readonly SectionCheckId[] };
}

interface State {
  input: ScoreInput;
  assume: Required<Assumptions>;
}

const withRoleSkill = (doc: ScoringDocument, skill: string, roleId: string | null): ScoringDocument => ({
  ...doc,
  skills: doc.skills.includes(skill) ? doc.skills : [...doc.skills, skill],
  roles: roleId === null ? doc.roles : doc.roles.map((r) => (r.id === roleId ? { ...r, skills: [...(r.skills ?? []), skill] } : r)),
});

/** The placeholder the fixes engine uses: only to measure; the user writes the real figure. */
const withFigure = (doc: ScoringDocument, roleId: string, index: number): ScoringDocument => ({
  ...doc,
  roles: doc.roles.map((r) => (r.id === roleId ? { ...r, bullets: r.bullets.map((b, i) => (i === index ? `${b} (1)` : b)) } : r)),
});

function apply(state: State, action: PathAction): State {
  const { input, assume } = state;
  switch (action.type) {
    case 'confirm_skill': {
      // The user's "yes, I used it there" is a new fact: it backs the document and the yardstick.
      const document = withRoleSkill(input.document, action.skillName, action.roleId);
      const profile = input.profile ? withRoleSkill(input.profile, action.skillName, input.profile.roles.some((r) => r.id === action.roleId) ? action.roleId : null) : undefined;
      return { input: { ...input, document, ...(profile ? { profile } : {}) }, assume };
    }
    case 'add_figure':
      return { input: { ...input, document: withFigure(input.document, action.roleId, action.bulletIndex) }, assume };
    case 'pass_section':
      return { input, assume: { ...assume, passedSections: new Set([...assume.passedSections, action.check]) } };
    case 'pass_format':
      return { input, assume: { ...assume, passedFormat: new Set([...assume.passedFormat, action.check]) } };
    case 'resolve_timeline':
      return { input, assume: { ...assume, removedClaims: new Set([...assume.removedClaims, `${action.roleId}\u0000${action.skillId}`]) } };
  }
}

const totalOf = (state: State): Bps => scoreCore(state.input, state.assume).totalBps ?? 0;

function idOf(action: PathAction): string {
  switch (action.type) {
    case 'confirm_skill':
      return `skill:${action.requirementId}`;
    case 'add_figure':
      return `figure:${action.roleId}:${action.bulletIndex}`;
    case 'pass_section':
      return `section:${action.check}`;
    case 'pass_format':
      return `format:${action.check}`;
    case 'resolve_timeline':
      return `timeline:${action.roleId}:${action.skillId}`;
  }
}

function candidates(input: ScoreInput, base: Omit<ScoreResult, 'fixes'>): PathAction[] {
  const actions: PathAction[] = [];
  for (const entry of base.ledger) {
    if (entry.kind !== 'skill' || !entry.skillId || !entry.tier) continue;
    if (entry.tier !== 'demonstrated') {
      actions.push({ type: 'confirm_skill', requirementId: entry.requirementId, skillName: entry.text, importance: entry.importance, roleId: bestRoleFor(entry.text, input.document, input), from: entry.tier === 'listed' ? 'listed' : 'gap' });
    }
  }
  for (const r of input.document.roles) {
    r.bullets.forEach((text, bulletIndex) => {
      if (!isQuantified(text, input.taxonomy) && canCarryResult(text)) actions.push({ type: 'add_figure', roleId: r.id, bulletIndex, text });
    });
  }
  for (const check of base.components.find((c) => c.key === 'sections')?.checks ?? []) {
    if (!check.passed) actions.push({ type: 'pass_section', check: check.id as SectionCheckId });
  }
  for (const check of base.components.find((c) => c.key === 'formatting')?.checks ?? []) {
    if (!check.passed) actions.push({ type: 'pass_format', check: check.id as FormatCheckId });
  }
  for (const pair of base.timeline.pairs) {
    if (!pair.included && (pair.verdict === 'invalid' || pair.verdict === 'suspect')) {
      actions.push({ type: 'resolve_timeline', roleId: pair.roleId, skillId: pair.skillId, skillName: pair.name });
    }
  }
  return actions;
}

/** What still costs points once every step is done: years the dated roles don't show. */
function blockersOf(result: Omit<ScoreResult, 'fixes'>): PathBlocker[] {
  return result.ledger
    .flatMap((e): PathBlocker[] =>
      e.status === 'partial' && e.tier === 'demonstrated' && e.years
        ? [{ type: 'years_short', requirementId: e.requirementId, skillName: e.text, askedYears: e.years.capped ?? e.years.asked, shownMonths: e.years.shownMonths }]
        : [],
    )
    .sort((a, b) => compareCodePoints(a.requirementId, b.requirementId));
}

function isAi(action: PathAction, aiCan: TargetPathOptions['aiCan']): boolean {
  if (action.type === 'pass_format') return aiCan?.format?.includes(action.check) ?? false;
  if (action.type === 'pass_section') return aiCan?.sections?.includes(action.check) ?? false;
  return false;
}

/** The path to `targetBps`, or undefined without a JD: there is no total to aim at (D-15). */
export function planToTarget(input: ScoreInput, options: TargetPathOptions): TargetPath | undefined {
  const base = scoreCore(input);
  if (base.totalBps === null) return undefined;
  const actions = candidates(input, base);
  const start: State = { input, assume: { passedSections: new Set(), passedFormat: new Set(), removedClaims: new Set() } };

  const ai = actions.filter((a) => isAi(a, options.aiCan));
  const yours = actions.filter((a) => !isAi(a, options.aiCan));
  const afterAi = ai.reduce(apply, start);
  const aiTotal = totalOf(afterAi);
  // The user's steps, the most valuable first, each priced alone on top of the AI's.
  const ranked = yours
    .map((action) => ({ action, id: idOf(action), alone: totalOf(apply(afterAi, action)) - aiTotal }))
    .sort((a, b) => b.alone - a.alone || compareCodePoints(a.id, b.id));

  const steps: PathStep[] = [];
  let state = start;
  let total = base.totalBps;
  const ordered = [...ai.map((action) => ({ action, id: idOf(action), who: 'ai' as const })), ...ranked.map((r) => ({ action: r.action, id: r.id, who: 'you' as const }))];
  for (const { action, id, who } of ordered) {
    const next = apply(state, action);
    const after = totalOf(next);
    // A step that adds nothing is left out, and not applied: the listed steps alone give the ceiling.
    if (after <= total) continue;
    state = next;
    steps.push({ id, action, who, gainBps: after - total, totalAfterBps: after });
    total = after;
  }

  const reached = steps.findIndex((s) => s.totalAfterBps >= options.targetBps);
  const stepsToTarget = base.totalBps >= options.targetBps ? 0 : reached < 0 ? null : reached + 1;
  return {
    targetBps: options.targetBps,
    startBps: base.totalBps,
    aiBps: aiTotal,
    steps,
    ceilingBps: total,
    reachesTarget: total >= options.targetBps,
    stepsToTarget,
    blockers: blockersOf(scoreCore(state.input, state.assume)),
  };
}
