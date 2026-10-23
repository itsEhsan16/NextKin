import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import type { PartialDate } from '@nextkin/engines/dates';
import type { FormatFacts, ScoringDocument } from '@nextkin/engines/document';
import type { Fix } from '@nextkin/engines/fixes';
import type { JdLists } from '@nextkin/engines/requirements';
import { score, type ScoreResult, type SectionCheckId } from '@nextkin/engines/rubric';
import { planToTarget, type TargetPath, type TargetPathOptions } from '@nextkin/engines/targetPlan';
import type { TimelinePair } from '@nextkin/engines/timeline';

import type { AtsFix, AtsReport, AtsScore, AtsTimelineFlag, ResumeValidation } from '../models/resume';
import { SCORE_RUBRIC } from '../models/resume';
import { requirementsOf } from './adapters';
import { checklistFor, FORMAT_LABEL, summaryFor } from './checklist';
import { resumePlausibility } from './plausibility';

/**
 * Engine result → the app's score models (C-10). One mapping, so the mock and the server describe
 * the same run the same way: the numbers come from `packages/engines`, the words from here.
 */

const points = (bps: number | null): number | null => (bps === null ? null : Math.round(bps / 10) / 10);
const percent = (bps: number | null): number | null => (bps === null ? null : Math.round(bps / 100));
const years = (months: number): number => Math.round((months / 12) * 10) / 10;

export const SECTION_FIX: Record<SectionCheckId, string> = {
  summary: 'Write a summary of at least 15 words',
  skills: 'List at least three skills',
  experience_dates: 'Give every role a start and an end date',
  education: 'Add your education',
  contact: 'Add an email, and a phone number or location',
};

const TIMELINE_REASON: Record<TimelinePair['rule'], string> = {
  ends_before_release: 'did not exist yet when this role ended',
  ends_before_release_unapproved: 'looks too new for this role; confirm it or take it off',
  before_safe_usage: 'was very new when this role ended; confirm early use or take it off',
  reaches_safe_usage: 'fits the role’s dates',
  not_in_kb: 'is not in our technology knowledge base yet',
  not_in_taxonomy: 'is not a skill we know yet',
  role_end_unknown: 'cannot be checked: the role has no end date',
};

const companyOf = (doc: ScoringDocument, roleId: string) => doc.roles.find((r) => r.id === roleId)?.company ?? 'this role';

function fixLabel(fix: Fix, doc: ScoringDocument): string {
  switch (fix.type) {
    case 'surface_backed_skill':
      return `Add "${fix.skillName}" — your profile backs it`;
    case 'gap':
      return `"${fix.skillName}" is not in your profile`;
    case 'ask_for_number':
      return `Add the real figure to a bullet in your ${companyOf(doc, fix.roleId)} role`;
    case 'complete_section':
      return SECTION_FIX[fix.check];
    case 'formatting':
      return `${FORMAT_LABEL[fix.check]}`;
    case 'mirror_wording':
      return `Write "${fix.to}" as the job does (you wrote "${fix.from}")`;
    case 'resolve_timeline':
      return `"${fix.skillName}" in your ${companyOf(doc, fix.roleId)} role ${TIMELINE_REASON[fix.verdict === 'invalid' ? 'ends_before_release' : 'before_safe_usage']}`;
  }
}

function toFix(fix: Fix, doc: ScoringDocument): AtsFix {
  const base = { id: fix.id, type: fix.type, label: fixLabel(fix, doc), impact: points(fix.impactBps) ?? 0, insertable: fix.type === 'surface_backed_skill' };
  switch (fix.type) {
    case 'surface_backed_skill':
      return { ...base, requirementId: fix.requirementId, skill: fix.skillName, section: 'roleId' in fix.target ? 'experience' : 'skills', ...('roleId' in fix.target ? { roleId: fix.target.roleId } : {}) };
    case 'gap':
      return { ...base, requirementId: fix.requirementId, skill: fix.skillName };
    case 'ask_for_number':
      return { ...base, roleId: fix.roleId, section: 'experience' };
    case 'mirror_wording':
      return { ...base, requirementId: fix.requirementId, skill: fix.to, section: 'skills' };
    case 'resolve_timeline':
      return { ...base, roleId: fix.roleId, skill: fix.skillName, section: 'experience' };
    case 'complete_section':
      return { ...base, ...(fix.check === 'summary' || fix.check === 'skills' ? { section: fix.check } : fix.check === 'education' ? { section: 'education' as const } : {}) };
    case 'formatting':
      return base;
  }
}

function basisFor(result: ScoreResult, key: string): string {
  const c = result.components.find((x) => x.key === key)!;
  const b = c.basis;
  switch (key) {
    case 'keywords':
      if (c.scoreBps === null) return 'Not measured without a job description';
      return `${b.requiredMet} of ${b.requiredTotal} required skills met${b.requiredPartial ? `, ${b.requiredPartial} partly` : ''}${b.preferredTotal ? `; ${b.preferredMet} of ${b.preferredTotal} preferred` : ''}`;
    case 'timeline':
      if (!b.checked) return 'No technology claims to check';
      return b.hardFails ? `${b.hardFails} technology ${b.hardFails === 1 ? 'claim conflicts' : 'claims conflict'} with the role’s dates` : `${b.passing} of ${b.checked} technology claims fit their roles’ dates`;
    case 'sections':
      return `${b.passed} of ${b.total} sections complete`;
    case 'formatting':
      return `${b.passed} of ${b.total} layout checks pass`;
    default:
      return `${b.quantified} of ${b.bullets} bullets show a measured outcome`;
  }
}

function flagOf(pair: TimelinePair): AtsTimelineFlag {
  return {
    roleId: pair.roleId,
    skill: pair.name,
    verdict: pair.verdict === 'valid' ? 'unverified' : pair.verdict,
    reason: TIMELINE_REASON[pair.rule],
    substitutions: pair.substitutions.map((s) => s.name),
  };
}

export function toAtsReport(result: ScoreResult, doc: ScoringDocument, previous?: AtsReport): AtsReport {
  const provenance = {
    engine: result.stamp.engine,
    rubric: result.stamp.rubric,
    taxonomy: result.stamp.taxonomy.version,
    kb: result.stamp.kb.version,
    asOf: result.stamp.asOf,
  };
  const p = previous?.provenance;
  const methodChanged = p !== undefined && (p.engine !== provenance.engine || p.rubric !== provenance.rubric || p.taxonomy !== provenance.taxonomy || p.kb !== provenance.kb);
  const t = result.timeline;
  return {
    total: result.total,
    components: result.components.map((c) => ({
      key: c.key,
      label: SCORE_RUBRIC.find((r) => r.key === c.key)?.label ?? c.key,
      weight: c.weightBps / 100,
      score: percent(c.scoreBps),
      points: points(c.contributionBps),
      basis: basisFor(result, c.key),
    })),
    jdMatch: result.jdMatch
      ? {
          percent: percent(result.jdMatch.matchBps) ?? 0,
          requiredMet: result.jdMatch.requiredMet,
          requiredPartial: result.jdMatch.requiredPartial,
          requiredTotal: result.jdMatch.requiredTotal,
          preferredMet: result.jdMatch.preferredMet,
          preferredTotal: result.jdMatch.preferredTotal,
          completeness: result.jdMatch.completeness,
        }
      : null,
    requirements: result.ledger.map((e) => ({
      id: e.requirementId,
      text: e.text,
      importance: e.importance,
      status: e.status,
      evidence: e.tier ?? null,
      ...(e.years ? { years: { asked: e.years.asked, shown: years(e.years.shownMonths) } } : {}),
      ...(e.wording ? { documentWording: e.wording.resume } : {}),
    })),
    fixes: result.fixes.map((f) => toFix(f, doc)),
    timeline: {
      checked: t.counts.checked,
      valid: t.counts.valid,
      suspect: t.counts.suspect,
      invalid: t.counts.invalid,
      unverified: t.counts.unverified,
      // What still needs the user: excluded claims, and unverified ones for the review queue. A
      // confirmed early adoption is resolved and drops out.
      flags: t.pairs.filter((pair) => !pair.included || pair.verdict === 'unverified').map(flagOf),
    },
    unbacked: result.unbackedClaims.map((c) => c.name),
    notMeasured: [...result.notMeasured],
    provenance: { ...provenance, reason: methodChanged ? 'method_change' : 'content_change' },
  };
}

export type ScoringJd = JdLists & { completeness: 'full' | 'snippet' };

export interface DocumentScore {
  report: AtsReport;
  /** The panel the apps render. Absent without a JD: no total exists then (D-15). */
  score?: AtsScore;
  validation: ResumeValidation;
  /** Section completeness, 0–1. */
  completeness: number;
  /** The path to a target score, when asked for and there is a JD (toreview §129). */
  path?: TargetPath;
}

/** Scores a document with the engines and maps the result for the apps. */
export function scoreDocument(args: {
  document: ScoringDocument;
  format: FormatFacts;
  asOf: PartialDate;
  jd?: ScoringJd;
  profile?: ScoringDocument;
  previous?: AtsScore;
  /** Also plan the path to a target (re-scores once per step, so only where it is shown). */
  path?: TargetPathOptions;
}): DocumentScore {
  const { document, format, asOf, jd, profile, previous } = args;
  const input = {
    document,
    format,
    asOf,
    kb: KB,
    taxonomy: TAXONOMY,
    ...(jd ? { jd: { requirements: requirementsOf(jd), text: jd.rawText, completeness: jd.completeness } } : {}),
    ...(profile ? { profile } : {}),
  };
  const result = score(input);
  const path = args.path && result.total !== null ? planToTarget(input, args.path) : undefined;
  const plausibility = resumePlausibility(document, asOf);
  const report = { ...toAtsReport(result, document, previous?.report), ...(plausibility.length ? { plausibility } : {}) };
  const sections = checklistFor(result, report, document);
  const atsScore: AtsScore | undefined =
    result.total === null || result.band === null
      ? undefined
      : { total: result.total, band: result.band, summary: summaryFor(report), sections, report };
  const flagged = report.timeline.flags.some((f) => f.verdict === 'invalid' || f.verdict === 'suspect');
  const formatting = result.components.find((c) => c.key === 'formatting')!;
  const sectionsPart = result.components.find((c) => c.key === 'sections')!;
  return {
    report,
    ...(atsScore ? { score: atsScore } : {}),
    validation: {
      timelineValid: !flagged,
      atsOptimized: formatting.scoreBps === 10_000,
      jdMatched: report.jdMatch !== null && report.jdMatch.requiredTotal > 0 && report.jdMatch.requiredMet === report.jdMatch.requiredTotal,
    },
    completeness: (sectionsPart.scoreBps ?? 0) / 10_000,
    ...(path ? { path } : {}),
  };
}
