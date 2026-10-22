import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { evidenceOf } from '@nextkin/engines/document';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { PARSE_SAFE_TEMPLATE } from '@nextkin/shared/scoring/adapters';
import { scoringDocumentOf } from '@nextkin/shared/scoring/canonical';
import { TAILOR_PATH } from '@nextkin/shared/scoring/fixPlan';
import { scoreDocument } from '@nextkin/shared/scoring/report';

import type { AiGateway } from '../src/ai/gateway';
import { createMemoryKv } from '../src/cache/kv';
import { extractJd } from '../src/pipeline/stages/extractJd';
import type { StageJd } from '../src/pipeline/stages/common';
import { assemble, generationInput, planFor, resumeDraftSchema, RESUME_TEMPLATE, REVISE_TEMPLATE } from '../src/pipeline/stages/resume';
import { validateDocument } from '../src/pipeline/stages/validate';
import { PROMPTS } from '../src/seed/prompts';
import type { PromptVersion } from '../src/services/prompts';
import { GOLDEN, GOLDEN_VERSION, type GoldenPair } from './golden';

/**
 * The eval harness (ImBackendImplementationPlan P9-06; V2 §16.4). Each golden pair goes through the
 * production code — JD extraction with span verification, the plan, generation, the validation loop
 * (ledger, bounded revision, strip) and the rubric — with whatever model the gateway routes to:
 * the reference model in unit tests, recordings in CI, the live API on demand (`pnpm eval --live`).
 *
 * Grounding is computed from the claim ledger, never by a model; supported-requirement recall
 * replaces raw keyword coverage; extraction is scored against the pairs' gold labels.
 */

export interface PairResult {
  id: string;
  family: GoldenPair['family'];
  extraction: { precision: number; recall: number };
  anachronisms: number;
  untraceableHardFacts: number;
  preStripViolations: number;
  revisions: number;
  stripped: number;
  supportedRecall: number | null;
  gapInsertions: number;
  total: number | null;
  /** The path to 8.5's ceiling on the generated resume, out of 100 (toreview §129). */
  ceiling: number | null;
  /** The ceiling is capped by years the profile's roles don't show: no honest step reaches them. */
  yearsBlocked: boolean;
}

export interface EvalReport {
  golden: string;
  pairs: PairResult[];
  totals: {
    anachronisms: number;
    untraceableHardFacts: number;
    gapInsertions: number;
    strippedClaims: number;
    revisionRate: number;
    supportedRecall: number;
    extractionPrecision: number;
    extractionRecall: number;
    /** Of the pairs years don't cap, the share whose path reaches 8.5 when every step is taken. */
    targetReachable: number;
  };
}

/** The release bar (§16.4 "the release is blocked below the bar"). */
export const BAR = {
  anachronisms: 0,
  untraceableHardFacts: 0,
  gapInsertions: 0,
  strippedClaims: 0,
  maxRevisionRate: 0.2,
  minSupportedRecall: 0.8,
  minExtractionPrecision: 0.9,
  minExtractionRecall: 0.8,
  /** Owner, 2026-10-21: following the plan reaches at least 8.5, unless years cap it. */
  minTargetReachable: 1,
} as const;

/** The seeded prompts as versions, for running without a database; tests may override bodies. */
export function seedPrompts(overrides: Record<string, string[]> = {}): Record<string, PromptVersion> {
  return Object.fromEntries(
    PROMPTS.map((p) => [p.name, { id: `seed:${p.name}:v1`, templateId: `seed:${p.name}`, version: 1, body: { system: overrides[p.name] ?? p.body.system } }]),
  );
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1);
const ids = (names: string[]) => new Set(names.map((n) => resolveSkill(TAXONOMY, n).id));

export async function runPair(pair: GoldenPair, gateway: AiGateway, prompts: Record<string, PromptVersion>, asOf = { year: 2026, month: 10 }): Promise<PairResult> {
  const context = { tag: 'eval' as const };
  const contact = { email: true, phone: true, location: true };
  const { jd: verified } = await extractJd({ gateway, cache: createMemoryKv(), prompt: prompts['jd.extract']!, text: pair.jd, context });
  const predicted = ids([...verified.requiredSkills, ...verified.preferredSkills, ...verified.tools]);
  const gold = ids([...pair.labels.required, ...pair.labels.preferred]);
  const hits = [...predicted].filter((id) => gold.has(id)).length;

  const jd: StageJd = {
    id: pair.id,
    title: verified.title ?? 'this role',
    company: verified.company,
    location: verified.location,
    requiredSkills: verified.requiredSkills,
    preferredSkills: verified.preferredSkills,
    tools: verified.tools,
    responsibilities: verified.responsibilities,
    rawText: pair.jd,
    completeness: 'snippet',
    language: verified.language,
  };
  const run = { kind: 'resume' as const, asOf, snapshot: { facts: pair.facts, contact } };
  const plan = planFor(pair.facts, jd, run);
  const { data } = await gateway.extract({
    stage: 'resume_generate',
    system: prompts[RESUME_TEMPLATE]!.body.system.map((text) => ({ text })),
    input: generationInput(pair.facts, plan, jd),
    schema: resumeDraftSchema,
    name: 'resume',
    description: 'The resume: a summary, skills and bullets per role, each citing the fact ids it rests on.',
    context,
  });
  const result = await validateDocument({ gateway, prompt: prompts[REVISE_TEMPLATE]!, facts: pair.facts, plan, jd, asOf, contact, document: assemble(pair.facts, data), context });

  const shown = evidenceOf(scoringDocumentOf(result.document, contact), TAXONOMY, { minCopiedWords: 8 }).evidence;
  const onDocument = new Set([...shown.listed, ...shown.roles.flatMap((r) => r.skills)]);
  const backed = ids(plan.backed);
  const score = scoreDocument({
    document: scoringDocumentOf(result.document, contact),
    format: PARSE_SAFE_TEMPLATE,
    asOf,
    jd: { requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, tools: jd.tools, rawText: jd.rawText, completeness: 'snippet' },
    path: TAILOR_PATH,
  });
  return {
    id: pair.id,
    family: pair.family,
    extraction: { precision: predicted.size ? hits / predicted.size : 1, recall: gold.size ? hits / gold.size : 1 },
    anachronisms: result.timeline.pairs.filter((p) => !p.included && p.verdict !== 'unverified').length,
    untraceableHardFacts: result.ledger.untraceableHardFacts,
    preStripViolations: result.preStripViolations,
    revisions: result.revisions,
    stripped: result.stripped.length,
    supportedRecall: backed.size ? [...backed].filter((id) => onDocument.has(id)).length / backed.size : null,
    gapInsertions: [...ids(plan.gaps)].filter((id) => onDocument.has(id)).length,
    total: score.report.total,
    ceiling: score.path ? Math.round(score.path.ceilingBps / 100) : null,
    yearsBlocked: (score.path?.blockers.length ?? 0) > 0,
  };
}

export async function runGolden(options: { gateway: AiGateway; prompts?: Record<string, PromptVersion>; pairs?: GoldenPair[] }): Promise<EvalReport> {
  const prompts = options.prompts ?? seedPrompts();
  const pairs: PairResult[] = [];
  for (const pair of options.pairs ?? GOLDEN) pairs.push(await runPair(pair, options.gateway, prompts));
  const sum = (key: 'anachronisms' | 'untraceableHardFacts' | 'gapInsertions' | 'stripped') => pairs.reduce((n, p) => n + p[key], 0);
  return {
    golden: GOLDEN_VERSION,
    pairs,
    totals: {
      anachronisms: sum('anachronisms'),
      untraceableHardFacts: sum('untraceableHardFacts'),
      gapInsertions: sum('gapInsertions'),
      strippedClaims: sum('stripped'),
      revisionRate: pairs.filter((p) => p.revisions > 0).length / Math.max(1, pairs.length),
      supportedRecall: mean(pairs.flatMap((p) => (p.supportedRecall === null ? [] : [p.supportedRecall]))),
      extractionPrecision: mean(pairs.map((p) => p.extraction.precision)),
      extractionRecall: mean(pairs.map((p) => p.extraction.recall)),
      targetReachable: mean(pairs.flatMap((p) => (p.ceiling === null || p.yearsBlocked ? [] : [p.ceiling >= TAILOR_PATH.targetBps / 100 ? 1 : 0]))),
    },
  };
}

/** The gate: every failure, in words. A release is blocked when any is present. */
export function gate(report: EvalReport, bar = BAR): { pass: boolean; failures: string[] } {
  const t = report.totals;
  const failures = [
    t.anachronisms > bar.anachronisms && `${t.anachronisms} anachronisms (bar ${bar.anachronisms})`,
    t.untraceableHardFacts > bar.untraceableHardFacts && `${t.untraceableHardFacts} untraceable hard facts`,
    t.gapInsertions > bar.gapInsertions && `${t.gapInsertions} gap requirements written in`,
    t.strippedClaims > bar.strippedClaims && `${t.strippedClaims} claims had to be stripped`,
    t.revisionRate > bar.maxRevisionRate && `revision rate ${(t.revisionRate * 100).toFixed(0)}% (bar ${bar.maxRevisionRate * 100}%)`,
    t.supportedRecall < bar.minSupportedRecall && `supported-requirement recall ${(t.supportedRecall * 100).toFixed(0)}%`,
    t.extractionPrecision < bar.minExtractionPrecision && `JD extraction precision ${(t.extractionPrecision * 100).toFixed(0)}%`,
    t.extractionRecall < bar.minExtractionRecall && `JD extraction recall ${(t.extractionRecall * 100).toFixed(0)}%`,
    t.targetReachable < bar.minTargetReachable && `only ${(t.targetReachable * 100).toFixed(0)}% of resumes can reach 8.5 by the plan`,
  ].filter((f): f is string => Boolean(f));
  return { pass: failures.length === 0, failures };
}
