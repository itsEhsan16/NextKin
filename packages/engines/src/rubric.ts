/**
 * The rubric and the score (V2 §7.8; ImBackendImplementationPlan P8-07, old M2-12; G4, G14, G17).
 *
 * Five components on the versioned rubric's weights: keyword match, timeline validity, section
 * completeness, formatting and parseability, quantified achievements. Every number is integer basis
 * points; re-scoring the same input under the same version returns the identical result.
 *
 * - An unresolved timeline hard fail zeroes the timeline component.
 * - JD match % is the keyword figure on its own, with "x of y required".
 * - **No total without a JD (D-15):** the keyword component is "not measured" and the total and
 *   band are null; the other four parts are still reported.
 * - The label stays the product's own ("ATS score" in the apps, D-07 escalated). Nothing here names
 *   or claims a result in a third-party system.
 */

import { compareCodePoints, divRoundHalfEven, FULL_BPS, ratioBps, weightedTotalBps, type Bps } from './bps';
import { fingerprint } from './canonical';
import type { PartialDate } from './dates';
import { allSkillIds, evidenceOf, roleText, type CopiedText, type FormatFacts, type ScoringDocument } from './document';
import { buildFixes, type Fix } from './fixes';
import type { KnowledgeBase } from './kb';
import { skillById, type Taxonomy } from './normalizer';
import { datasetRef, ENGINE_VERSION, rubricById, type ComponentKey, type RubricVersion, type Stamp } from './provenance';
import { yearsCeilings } from './plausibility';
import { isQuantified } from './quantified';
import { buildLedger, type LedgerEntry, type Requirement, type RequirementLedger } from './requirements';
import { wordCount } from './text';
import { validateTimeline, type EarlyAdoption, type TimelineReport } from './timeline';

export type Band = 'strong' | 'good' | 'fair' | 'weak';
export type SectionCheckId = 'summary' | 'skills' | 'experience_dates' | 'education' | 'contact';
export type FormatCheckId = keyof FormatFacts;

export interface Check<Id extends string = string> {
  id: Id;
  passed: boolean;
}

export interface ComponentResult {
  key: ComponentKey;
  weightBps: Bps;
  /** The component's own score; null when it is not measured (keywords without a JD). */
  scoreBps: Bps | null;
  /** weight × score: the points it adds to the total. */
  contributionBps: Bps | null;
  /** What the number rests on, as counts: "3 of 5 bullets", "2 of 6 required met". */
  basis: Record<string, number>;
  checks?: Check[];
}

export interface JdInput {
  requirements: readonly Requirement[];
  /** The JD text, for detecting text copied into the resume. */
  text?: string;
  /** A full description or a listing snippet: a snippet's match says less. */
  completeness: 'full' | 'snippet';
}

export interface ScoreInput {
  document: ScoringDocument;
  format: FormatFacts;
  jd?: JdInput;
  /** The profile, as a document: the yardstick for a generated resume, and what fixes cite. */
  profile?: ScoringDocument;
  kb: KnowledgeBase;
  taxonomy: Taxonomy;
  asOf: PartialDate;
  confirmations?: readonly EarlyAdoption[];
  /** A published rubric version; the current one when absent. */
  rubricId?: string;
  /** A draft version under evaluation before it is published (P12 gates publishing on evals). */
  rubric?: RubricVersion;
}

export interface ScoreResult {
  /** 0–100, or null without a JD (D-15). */
  total: number | null;
  totalBps: Bps | null;
  band: Band | null;
  /** The measured components' points, whether or not a total exists. */
  pointsBps: Bps;
  components: ComponentResult[];
  jdMatch: (RequirementLedger['counts'] & { matchBps: Bps | null; completeness: 'full' | 'snippet' }) | null;
  ledger: LedgerEntry[];
  timeline: TimelineReport;
  /** Skills the document shows that the profile does not back (generated documents). */
  unbackedClaims: { skillId: string; name: string }[];
  copiedFromJd: CopiedText[];
  fixes: Fix[];
  notMeasured: readonly string[];
  stamp: Stamp;
  contentFingerprint: string;
}

/** What the score does not measure, stated beside every score (§7.8). */
export const NOT_MEASURED: readonly string[] = [
  'How any employer’s software will read, rank or filter the document.',
  'Whether a claim is true beyond what the profile states.',
  'Writing style: lint suggestions never change the score.',
  'Eligibility (work authorization, language, location, clearance): flagged, never scored.',
];

/** What-if overrides, used only to simulate a fix's impact. */
export interface Assumptions {
  passedSections?: ReadonlySet<SectionCheckId>;
  passedFormat?: ReadonlySet<FormatCheckId>;
  /** `roleId\0skillId` claims taken off the document. */
  removedClaims?: ReadonlySet<string>;
}

export function bandFor(total: number, rubric: RubricVersion): Band {
  if (total >= rubric.bands.strong) return 'strong';
  if (total >= rubric.bands.good) return 'good';
  if (total >= rubric.bands.fair) return 'fair';
  return 'weak';
}

function sectionChecks(doc: ScoringDocument, skillCount: number, rubric: RubricVersion): Check<SectionCheckId>[] {
  return [
    { id: 'summary', passed: wordCount(doc.summary ?? '') >= rubric.sections.summaryMinWords },
    { id: 'skills', passed: skillCount >= rubric.sections.skillsMin },
    { id: 'experience_dates', passed: doc.roles.length > 0 && doc.roles.every((r) => r.start && r.end !== undefined) },
    { id: 'education', passed: doc.education.length > 0 },
    { id: 'contact', passed: doc.contact.email && (doc.contact.phone || doc.contact.location) },
  ];
}

function datesConsistent(doc: ScoringDocument): boolean {
  if (doc.roles.length === 0) return true;
  if (!doc.roles.every((r) => r.start && r.end !== undefined)) return false;
  // Every stated date written to the same precision: all with months, or all years only.
  const precisions = new Set(
    doc.roles.flatMap((r) => [r.start, r.end]).flatMap((d) => (d ? [d.month === undefined] : [])),
  );
  return precisions.size <= 1;
}

function component(key: ComponentKey, rubric: RubricVersion, scoreBps: Bps | null, basis: Record<string, number>, checks?: Check[]): ComponentResult {
  const weightBps = rubric.components.find((c) => c.key === key)!.weightBps;
  const contributionBps = scoreBps === null ? null : divRoundHalfEven(weightBps * scoreBps, FULL_BPS);
  return { key, weightBps, scoreBps, contributionBps, basis, ...(checks ? { checks } : {}) };
}

/** The score without fixes: what fix simulation re-runs. */
export function scoreCore(input: ScoreInput, assume: Assumptions = {}): Omit<ScoreResult, 'fixes'> {
  const rubric = input.rubric ?? rubricById(input.rubricId);
  const { document: doc, taxonomy, kb, asOf } = input;
  const removed = assume.removedClaims ?? new Set<string>();

  // The JD's phrases the taxonomy does not know are looked for in the text too (toreview §112).
  const phrases = (input.jd?.requirements ?? []).flatMap((r) => (r.skill && !r.skill.known ? [r.skill.id] : []));
  const docEvidence = evidenceOf(doc, taxonomy, { jdText: input.jd?.text, minCopiedWords: rubric.pastedMinWords, removed, phrases });
  const profileEvidence = input.profile ? evidenceOf(input.profile, taxonomy, { minCopiedWords: rubric.pastedMinWords, phrases }).evidence : undefined;

  // Keywords: the requirement ledger.
  const ledger = input.jd
    ? buildLedger({
        requirements: input.jd.requirements,
        evidence: docEvidence.evidence,
        backing: profileEvidence,
        rubric,
        asOf,
        ...(rubric.yearsCappedAtTechAge ? { yearsCeiling: yearsCeilings(input.jd.requirements, kb, asOf) } : {}),
      })
    : null;
  const keywords = component('keywords', rubric, ledger?.matchBps ?? null, ledger ? { ...ledger.counts } : {});

  // Timeline: every technology claim on every role.
  const report = validateTimeline({
    roles: doc.roles.map((r) => ({ id: r.id, start: r.start, end: r.end, skills: r.skills, text: roleText(r) })),
    kb,
    taxonomy,
    asOf,
    confirmations: input.confirmations,
  });
  const pairs = report.pairs.filter((p) => !removed.has(`${p.roleId}\u0000${p.skillId}`));
  const hardFails = pairs.filter((p) => p.hardFail).length;
  const passing = pairs.filter((p) => p.included).length;
  const timelineScore = hardFails > 0 ? 0 : pairs.length === 0 ? FULL_BPS : ratioBps(passing, pairs.length);
  const timeline = component('timeline', rubric, timelineScore, { checked: pairs.length, passing, hardFails });

  // Sections.
  const skillCount = docEvidence.evidence.listed.length;
  const sections = sectionChecks(doc, skillCount, rubric).map((c) => (assume.passedSections?.has(c.id) ? { ...c, passed: true } : c));
  const sectionsPassed = sections.filter((c) => c.passed).length;
  const sectionsResult = component('sections', rubric, ratioBps(sectionsPassed, sections.length), { passed: sectionsPassed, total: sections.length }, sections);

  // Formatting.
  const facts: Required<FormatFacts> = { ...input.format, consistentDates: input.format.consistentDates ?? datesConsistent(doc) };
  const formatChecks = (Object.keys(facts) as FormatCheckId[])
    .sort(compareCodePoints)
    .map((id) => ({ id, passed: facts[id] || assume.passedFormat?.has(id) === true }));
  const formatPassed = formatChecks.filter((c) => c.passed).length;
  const formatting = component('formatting', rubric, ratioBps(formatPassed, formatChecks.length), { passed: formatPassed, total: formatChecks.length }, formatChecks);

  // Achievements: the share of experience bullets with a measurable outcome.
  const bullets = doc.roles.flatMap((r) => r.bullets);
  const quantified = bullets.filter((b) => isQuantified(b, taxonomy)).length;
  const achievements = component('achievements', rubric, bullets.length === 0 ? 0 : ratioBps(quantified, bullets.length), { quantified, bullets: bullets.length });

  const components = [keywords, timeline, sectionsResult, formatting, achievements];
  const pointsBps = components.reduce((sum, c) => sum + (c.contributionBps ?? 0), 0);
  const totalBps =
    keywords.scoreBps === null
      ? null
      : weightedTotalBps(components.map((c) => ({ weightBps: c.weightBps, scoreBps: c.scoreBps ?? 0 })));
  const total = totalBps === null ? null : divRoundHalfEven(totalBps, 100);

  const shown = allSkillIds(docEvidence.evidence);
  const backed = profileEvidence ? allSkillIds(profileEvidence) : null;
  const unbackedClaims = backed
    ? [...shown].filter((id) => !backed.has(id)).sort(compareCodePoints).map((id) => ({ skillId: id, name: skillById(taxonomy, id)?.name ?? id.slice(2) }))
    : [];

  const stamp: Stamp = {
    engine: ENGINE_VERSION,
    rubric: rubric.id,
    rubricFingerprint: fingerprint(rubric),
    taxonomy: datasetRef(taxonomy),
    kb: datasetRef(kb),
    asOf: report.asOf,
  };

  return {
    total,
    totalBps,
    band: total === null ? null : bandFor(total, rubric),
    pointsBps,
    components,
    jdMatch: ledger && input.jd ? { ...ledger.counts, matchBps: ledger.matchBps, completeness: input.jd.completeness } : null,
    ledger: ledger?.entries ?? [],
    timeline: { ...report, pairs },
    unbackedClaims,
    copiedFromJd: docEvidence.copied,
    notMeasured: NOT_MEASURED,
    stamp,
    contentFingerprint: fingerprint({
      document: doc,
      format: input.format,
      jd: input.jd ?? null,
      profile: input.profile ?? null,
      confirmations: input.confirmations ?? [],
    }),
  };
}

/** Scores a document: the result, its basis and typed fixes with simulated impact. */
export function score(input: ScoreInput): ScoreResult {
  const base = scoreCore(input);
  return { ...base, fixes: buildFixes(input, base) };
}
