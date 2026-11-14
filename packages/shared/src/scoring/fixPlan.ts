import { rubricById } from '@nextkin/engines/provenance';
import type { FormatCheckId, SectionCheckId } from '@nextkin/engines/rubric';
import type { PathStep, TargetPath, TargetPathOptions } from '@nextkin/engines/targetPlan';

import type { AtsComponentKey, TailorImprovement } from '../models';
import { FORMAT_LABEL } from './checklist';
import { quoteOf } from './jdText';
import { SECTION_FIX, type DocumentScore } from './report';

/**
 * "Your fix plan" (toreview §115, owner 2026-10-19): the comparison as what the job needs and how
 * to get there, ranked by what each step is worth. Every number is the engine's (G17):
 * - a part of the score loses what its weight times its shortfall says;
 * - a typed fix is worth what re-scoring with it gave (`AtsFix.impact`);
 * - a missing keyword, which the engine prices at 0 because nothing backs it, is priced as what it
 *   WOULD add if the user has it: the keyword part's weight × its share of the requirements ×
 *   the credit (half when only listed, full when a dated role shows it, D-14).
 * Steps the score does not measure (headline, summary wording) say so instead of a number.
 *
 * With the path to the target (toreview §129, `engines/targetPlan.ts`), the steps are that path's:
 * applied one after another and re-scored after each, so a step's worth is what it adds after the
 * ones above it and `totalAfter` is the score once it is done. The projection is a re-score, not a
 * sum. The per-step pricing above is only the fallback for a result scored without a path.
 */

/** The owner's bar (2026-10-21): following the plan reaches at least 8.5 out of 10. */
export const TARGET_SCORE = 8.5;

const ALL_FORMAT: readonly FormatCheckId[] = ['singleColumn', 'standardHeadings', 'noTablesOrImages', 'standardFonts', 'contactInBody'];

/**
 * What a tailored run fixes on its own: it downloads in NextKin's one-column template (every
 * layout check but date precision, which is the user's own dates), and it writes the summary from
 * the resume's own lines.
 */
export const TAILOR_PATH: TargetPathOptions = { targetBps: TARGET_SCORE * 1000, aiCan: { format: ALL_FORMAT, sections: ['summary'] } };

export type PlanWho = 'ai' | 'you' | 'nobody';

export type PlanStep = {
  id: string;
  kind: 'keyword' | 'evidence' | 'number' | 'timeline' | 'wording' | 'headline' | 'summary' | 'years' | 'section' | 'format';
  title: string;
  /** The job's own line asking for it, when it names one. */
  need?: string;
  /** What the resume shows today. */
  have: string;
  /** Points out of 10 it adds, or null when the score does not measure it. */
  worth: number | null;
  /** Why it is worth that, in words. */
  basis: string;
  who: PlanWho;
  /** The keyword a "I have this" tick adds, for keyword and evidence steps. */
  keyword?: string;
  importance?: 'required' | 'preferred';
  /** The score out of 10 once this step and every one above it is done (the path's re-score). */
  totalAfter?: number;
  /** The bullet a "number" step asks the real figure for. */
  bullet?: { roleId: string; index: number; text: string };
  /**
   * A skill step's place, chosen by code (`engines/placement.ts`): the dated role it fits best,
   * where the step was measured. Ticking it takes this place unless the user picks another.
   */
  where?: string;
};

/** How far the plan goes (toreview §129): the bar, what the AI alone reaches, and the honest ceiling. */
export type PlanTarget = {
  goal: number;
  /** After the AI's own steps, before any of yours. */
  ai: number;
  /** With every step done: the most this resume can honestly reach for this job. */
  ceiling: number;
  reaches: boolean;
  /** How many steps, from the top, reach the goal; 0 when already there, null when never. */
  steps: number | null;
};

export type ScorePart = { key: AtsComponentKey; label: string; max: number; got: number; lost: number; basis: string };

export type FixPlan = { score: number; parts: ScorePart[]; steps: PlanStep[]; target?: PlanTarget };

/** Points out of 100 as points out of 10, to one decimal. */
const tenth = (points: number) => (points > 0 ? Math.max(0.1, Math.round(points) / 10) : 0);
/** Basis points of the total as a score out of 10, rounded the way the total is. */
const outOf10 = (bps: number) => Math.round(bps / 100) / 10;
const clip = (text: string, n = 70) => (text.length <= n ? text : `${text.slice(0, n - 1).trimEnd()}…`);

function pathStepOf(step: PathStep, report: DocumentScore['report'], rawText: string | undefined): PlanStep {
  const scored = { id: `path:${step.id}`, worth: tenth(step.gainBps / 100), totalAfter: outOf10(step.totalAfterBps), who: step.who };
  const a = step.action;
  switch (a.type) {
    case 'confirm_skill': {
      const need = quoteOf(rawText, a.skillName);
      const base = { ...scored, keyword: a.skillName, importance: a.importance, ...(need ? { need } : {}), ...(a.roleId ? { where: a.roleId } : {}) };
      const placed = a.roleId ? 'The AI places it in the role it fits best' : 'No role’s dates fit it, so it goes in your Skills';
      return a.from === 'gap'
        ? { ...base, kind: 'keyword', title: `Add ${a.skillName}`, have: 'Not on your resume', basis: `Only if you’ve used it. ${placed}` }
        : { ...base, kind: 'evidence', title: `Show ${a.skillName} in a role`, have: 'Only in your skills list — half credit', basis: placed };
    }
    case 'add_figure':
      return { ...scored, kind: 'number', title: `Add the result to “${clip(a.text)}”`, have: 'No measured result yet', basis: 'Write the real figure: a number, a %, time or money saved. Nothing is made up.', bullet: { roleId: a.roleId, index: a.bulletIndex, text: a.text } };
    case 'pass_section':
      return { ...scored, kind: 'section', title: a.check === 'summary' && step.who === 'ai' ? 'Write a summary aimed at this job' : SECTION_FIX[a.check as SectionCheckId], have: 'Missing or too short', basis: step.who === 'ai' ? 'The AI writes it from your own lines' : 'What re-scoring with it gives' };
    case 'pass_format':
      return { ...scored, kind: 'format', title: FORMAT_LABEL[a.check], have: 'Your file’s layout', basis: step.who === 'ai' ? 'Downloads in NextKin’s one-column template' : 'Write every date the same way' };
    case 'resolve_timeline': {
      const fix = report.fixes.find((f) => f.id === `timeline:${a.roleId}:${a.skillId}`);
      return { ...scored, kind: 'timeline', title: fix?.label ?? `${a.skillName} doesn’t fit a role’s dates`, have: 'A date or a technology’s era doesn’t add up', basis: 'Fix the dates, or take it off that role' };
    }
  }
}

function pathPlan(path: TargetPath, report: DocumentScore['report'], rawText: string | undefined): { steps: PlanStep[]; target: PlanTarget } {
  const steps = path.steps.map((s) => pathStepOf(s, report, rawText));
  for (const b of path.blockers) {
    const need = quoteOf(rawText, b.skillName);
    steps.push({ id: `yr:${b.requirementId}`, kind: 'years', title: `${b.skillName}: ${b.askedYears}+ years asked`, have: `Your roles show ${Math.round((b.shownMonths / 12) * 10) / 10} years`, worth: null, basis: 'Tailoring can’t add years; lead with what you did with it', who: 'nobody', keyword: b.skillName, ...(need ? { need } : {}) });
  }
  return {
    steps,
    target: { goal: path.targetBps / 1000, ai: outOf10(path.aiBps), ceiling: outOf10(path.ceilingBps), reaches: path.reachesTarget, steps: path.stepsToTarget },
  };
}

/** How many next steps a ready screen is given. */
export const NEXT_STEPS = 4;

/**
 * What is left after a run (toreview §206.3): the plan rebuilt on the finished resume, and of it
 * only the steps the candidate alone can take that the score measures. Each worth is the path's
 * own re-score, so the line never promises more than doing it would give.
 */
export function nextStepsOf(result: DocumentScore | undefined, rawText?: string): { title: string; worth: number }[] {
  const plan = fixPlanOf({ result, ...(rawText ? { rawText } : {}), improvements: [] });
  return (plan?.steps ?? [])
    .filter((step) => step.who === 'you' && step.worth !== null && step.worth > 0)
    .slice(0, NEXT_STEPS)
    .map((step) => ({ title: step.title, worth: step.worth as number }));
}

export function fixPlanOf(args: { result: DocumentScore | undefined; rawText?: string; improvements: readonly TailorImprovement[] }): FixPlan | undefined {
  const report = args.result?.report;
  if (!report || report.total === null) return undefined;
  const rubric = rubricById();

  const parts: ScorePart[] = report.components
    .filter((c) => c.points !== null)
    .map((c) => ({ key: c.key, label: c.label, max: c.weight / 10, got: (c.points ?? 0) / 10, lost: Math.max(0, (c.weight - (c.points ?? 0)) / 10), basis: c.basis }))
    .sort((a, b) => b.lost - a.lost);

  // The keyword part as the ledger builds it: a weighted average of each requirement's credit.
  const keywordWeight = report.components.find((c) => c.key === 'keywords')?.weight ?? 0;
  const skills = report.requirements.filter((r) => r.status !== 'eligibility');
  const weightOf = (importance: 'required' | 'preferred') => rubric.requirementWeight[importance];
  const totalWeight = skills.reduce((n, r) => n + weightOf(r.importance), 0);
  const share = (importance: 'required' | 'preferred', creditBps: number) => (totalWeight > 0 ? (keywordWeight * weightOf(importance) * creditBps) / 10_000 / totalWeight : 0);

  if (args.result?.path) {
    const { steps, target } = pathPlan(args.result.path, report, args.rawText);
    for (const row of args.improvements) {
      if (row.ok) continue;
      if (row.key === 'headline') steps.push({ id: 'headline', kind: 'headline', title: 'Aim your headline at this job', have: row.detail, worth: null, basis: 'Not in the score — it is the first line a recruiter reads', who: 'ai' });
      else if (row.key === 'years') steps.push({ id: 'years', kind: 'years', title: 'Fewer years than the job asks', have: row.detail, worth: null, basis: 'Nothing tailoring can change', who: 'nobody' });
    }
    return { score: report.total / 10, parts, steps, target };
  }

  const steps: PlanStep[] = [];
  for (const r of skills) {
    const need = quoteOf(args.rawText, r.text);
    const base = { keyword: r.text, importance: r.importance, ...(need ? { need } : {}) };
    if (r.status === 'gap') {
      const listed = share(r.importance, rubric.credit.listed);
      const shown = share(r.importance, rubric.credit.demonstrated);
      steps.push({ id: `kw:${r.id}`, kind: 'keyword', title: `Add ${r.text}`, have: 'Not on your resume', worth: tenth(shown), basis: `+${tenth(listed)} in your skills, +${tenth(shown)} when a role shows it — only if you have it`, who: 'you', ...base });
    } else if (r.status === 'partial' && r.evidence === 'listed') {
      const more = share(r.importance, rubric.credit.demonstrated - rubric.credit.listed);
      steps.push({ id: `ev:${r.id}`, kind: 'evidence', title: `Show ${r.text} in a role`, have: 'Only in your skills list — half credit', worth: tenth(more), basis: 'Full credit once a role you held shows it', who: 'you', ...base });
    } else if (r.status === 'partial' && r.years) {
      steps.push({ id: `yr:${r.id}`, kind: 'evidence', title: `${r.text}: ${r.years.asked}+ years asked`, have: `Your roles show ${r.years.shown} years`, worth: null, basis: 'Tailoring can’t add years; lead with what you did with it', who: 'nobody', ...base });
    }
  }
  for (const fix of report.fixes) {
    if (fix.type === 'gap' || fix.type === 'surface_backed_skill' || fix.impact <= 0) continue;
    const kind = fix.type === 'ask_for_number' ? 'number' : fix.type === 'resolve_timeline' ? 'timeline' : 'wording';
    steps.push({ id: `fix:${fix.id}`, kind, title: fix.label, have: kind === 'number' ? 'Bullets without a measured result' : kind === 'timeline' ? 'A date or a technology’s era doesn’t add up' : 'Worded differently from the job', worth: tenth(fix.impact), basis: 'What re-scoring with this change gives', who: kind === 'wording' ? 'ai' : 'you' });
  }
  for (const row of args.improvements) {
    if (row.ok) continue;
    if (row.key === 'headline') steps.push({ id: 'headline', kind: 'headline', title: 'Aim your headline at this job', have: row.detail, worth: null, basis: 'Not in the score — it is the first line a recruiter reads', who: 'ai' });
    else if (row.key === 'summary') steps.push({ id: 'summary', kind: 'summary', title: 'Rewrite your summary for this job', have: row.detail, worth: null, basis: 'Not in the score itself — it carries the job’s keywords into your words', who: 'ai' });
    else if (row.key === 'years') steps.push({ id: 'years', kind: 'years', title: 'Fewer years than the job asks', have: row.detail, worth: null, basis: 'Nothing tailoring can change', who: 'nobody' });
  }

  // What is worth the most first; unmeasured AI steps next; what nobody can change last.
  const required = (s: PlanStep) => (s.importance === 'required' ? 0 : 1);
  const rank = (s: PlanStep) => (s.who === 'nobody' ? 2 : s.worth === null ? 1 : 0);
  steps.sort((a, b) => rank(a) - rank(b) || (b.worth ?? 0) - (a.worth ?? 0) || required(a) - required(b));
  return { score: report.total / 10, parts, steps };
}
