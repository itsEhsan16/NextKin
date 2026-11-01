import { buildClaimLedger, stripHardFacts, violatingSections, type ClaimLedger } from '@nextkin/engines/claims';
import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import type { ProfileFacts } from '@nextkin/engines/facts';
import { lint, type LintSuggestion } from '@nextkin/engines/lint';
import { marketForLocation, MARKETS } from '@nextkin/engines/markets';
import { phraseKey } from '@nextkin/engines/text';
import type { TimelineReport } from '@nextkin/engines/timeline';
import { validateTimeline } from '@nextkin/engines/timeline';
import type { TailorChange } from '@nextkin/shared/models/tailor';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { EXPERIENCED_MONTHS, pageBudget } from '@nextkin/shared/scoring/pageBudget';
import { scoringDocumentOf, toEngineResume } from '@nextkin/shared/scoring/canonical';
import { withFigures } from '@nextkin/shared/scoring/documentFacts';
import { z } from 'zod';

import type { AiGateway, CallContext } from '../../ai/gateway';
import type { Database } from '../../db/database';
import type { LatexDensity } from '../../export/latex/types';
import type { PromptVersion } from '../../services/prompts';
import type { ContactPresence } from '@nextkin/shared/scoring/adapters';
import { StageError, type StageContext, type StageDef } from '../stages';
import { userPaper } from '../../services/renders';
import { readRun, type RunInput, type StageJd } from './common';
import { generationInput, REVISE_TEMPLATE, type ResumePlan } from './resume';
import { compiledMeasure, dropOrder, estimateMeasure, fitToPages } from './pageFit';
import { changesOf } from './tailorChanges';
import { mergeTailored, recentRoleIds, strippedInUse, tailorOf, type TailorRunInput } from './tailorMerge';

/**
 * Validation (ImBackendImplementationPlan P9-03, P9-04; V2 §7.6–§7.7; G13). The claim ledger and the
 * timeline post-check read the generated document against the facts. Violating sections get at
 * most `MAX_REVISIONS` rewrites, each told exactly what failed; what is still invented after that
 * is stripped (hard facts) or flagged (the rest). Lint runs for the JD's market and only suggests.
 * Technologies the KB does not know go to the review queue (§7.7).
 */

export const MAX_REVISIONS = 2;

const cited = z.object({ text: z.string().trim().min(1).max(400), evidence: z.array(z.string().max(80)).min(1).max(8) });
export const revisionSchema = z.object({
  summary: cited.nullable(),
  skills: z.array(z.object({ name: z.string().trim().min(1).max(80), evidence: z.array(z.string().max(80)).min(1).max(5) })).nullable(),
  roles: z.array(z.object({ roleId: z.string().max(80), bullets: z.array(cited).max(6) })),
});

export interface ValidationOutput {
  document: CanonicalResumeJson;
  ledger: ClaimLedger;
  timeline: TimelineReport;
  lint: LintSuggestion[];
  revisions: number;
  /** Lines the check took out of the draft: the line itself for the Versions page (§146.5). */
  stripped: { claimId: string; reason: string; text?: string }[];
  /** A tailored run's merge (toreview §110.3): what changed against the base, and its length. */
  tailor?: { baseVersionId: string; changes: TailorChange[]; pages: number; density?: LatexDensity; pagesCompiled?: boolean; pageBasis?: string };
}

/** `leftOut`: a tailored run's unticked keywords, which no generated claim may name. */
export const ledgerOf = (doc: CanonicalResumeJson, facts: ProfileFacts, asOf: { year: number; month?: number }, leftOut?: readonly string[]) =>
  buildClaimLedger({ document: toEngineResume(doc), facts, taxonomy: TAXONOMY, kb: KB, asOf, ...(leftOut?.length ? { leftOut } : {}) });

const marketOf = (jd: StageJd | null) => MARKETS.profiles[marketForLocation(jd?.location ?? undefined) ?? 'us'];

/** The timeline post-check (§7.7): each profile role's dates against what the document says it used. */
export const timelineOf = (doc: CanonicalResumeJson, facts: ProfileFacts, asOf: { year: number; month?: number }): TimelineReport =>
  validateTimeline({
    roles: facts.roles.map((r) => ({
      id: r.id,
      start: r.start,
      end: r.end,
      text: doc.roles.find((d) => d.roleId === r.id)?.bullets.map((b) => b.text).join('\n') ?? '',
    })),
    kb: KB,
    taxonomy: TAXONOMY,
    asOf,
  });

/** Replaces only the sections a revision was asked for. */
function merge(doc: CanonicalResumeJson, revision: z.infer<typeof revisionSchema>, wanted: ReturnType<typeof violatingSections>, attempt: number): CanonicalResumeJson {
  return {
    ...doc,
    ...(wanted.summary ? (revision.summary ? { summary: { id: 's', text: revision.summary.text, evidence: revision.summary.evidence, origin: 'generated' as const } } : { summary: undefined }) : {}),
    ...(wanted.skills && revision.skills ? { skills: revision.skills.map((s, i) => ({ id: `k${i}`, name: s.name, evidence: s.evidence, origin: 'generated' as const })) } : {}),
    roles: doc.roles.map((role, ri) => {
      if (!wanted.roleIds.includes(role.roleId)) return role;
      const next = revision.roles.find((r) => r.roleId === role.roleId);
      return next ? { ...role, bullets: next.bullets.map((b, bi) => ({ id: `b${ri}-${bi}-r${attempt}`, text: b.text, evidence: b.evidence, origin: 'generated' as const })) } : role;
    }),
  };
}

/** Unverified technologies go to the KB review queue, counted (system role: the queue is internal). */
export async function queueForReview(db: Database, names: string[]): Promise<void> {
  if (names.length === 0) return;
  await db.withSystem('pipeline: queue unverified technologies for KB review', async (tx) => {
    for (const name of names.slice(0, 50)) {
      const key = phraseKey(name).slice(0, 120);
      if (!key) continue;
      await tx
        .insertInto('kb_review_queue')
        .values({ name_key: key, name: name.slice(0, 120) })
        .onConflict((oc) => oc.column('name_key').doUpdateSet((eb) => ({ occurrences: eb('kb_review_queue.occurrences', '+', 1), last_seen_at: new Date() })))
        .execute();
    }
  });
}

/** A claim's words, by its id in the document. */
const claimTextOf = (doc: CanonicalResumeJson, id: string): string | undefined =>
  id === 's' ? doc.summary?.text : (doc.skills.find((s) => s.id === id)?.name ?? doc.roles.flatMap((r) => r.bullets).find((b) => b.id === id)?.text);

export interface ValidateArgs {
  gateway: AiGateway;
  prompt: PromptVersion;
  facts: ProfileFacts;
  plan: ResumePlan;
  jd: StageJd | null;
  asOf: { year: number; month?: number };
  contact: ContactPresence;
  document: CanonicalResumeJson;
  context: CallContext;
  leftOut?: readonly string[];
}

/**
 * The validation loop on its own (no database): the pipeline's stage and the eval harness (P9-06)
 * run exactly this. Returns the final document, its ledger, the timeline report and lint.
 */
export async function validateDocument(args: ValidateArgs): Promise<ValidationOutput & { preStripViolations: number }> {
  const { facts, jd, asOf, leftOut } = args;
  let doc = args.document;
  let ledger = ledgerOf(doc, facts, asOf, leftOut);
  const firstViolations = ledger.counts.violations;
  let revisions = 0;

  while (ledger.counts.violations > 0 && revisions < MAX_REVISIONS) {
    revisions += 1;
    const wanted = violatingSections(ledger);
    const failures = ledger.results.filter((r) => r.status === 'violation').map((r) => ({ claimId: r.claimId, issues: r.issues.filter((i) => i.severity === 'hard').map((i) => i.detail) }));
    const claimText = (id: string) => claimTextOf(doc, id);
    const { data } = await args.gateway.extract({
      stage: 'resume_revise',
      system: args.prompt.body.system.map((text) => ({ text })),
      input: {
        rewrite: { summary: wanted.summary, skills: wanted.skills, roleIds: wanted.roleIds },
        failures: failures.map((f) => ({ ...f, text: claimText(f.claimId) })),
        ...generationInput(facts, args.plan, jd),
      },
      schema: revisionSchema,
      name: 'revision',
      description: 'Rewrites of only the sections named in `rewrite`, every claim citing the facts it rests on.',
      context: args.context,
    });
    doc = merge(doc, data, wanted, revisions);
    ledger = ledgerOf(doc, facts, asOf, leftOut);
  }
  const preStripViolations = ledger.counts.violations;

  // Still invented after the bounded rewrites: strip it (G13), and read the result once more.
  const { document: strippedEngine, stripped: taken } = stripHardFacts(toEngineResume(doc), ledger, facts);
  const before = doc;
  const stripped = taken.map((line) => {
    const text = claimTextOf(before, line.claimId);
    return text ? { ...line, text } : line;
  });
  if (stripped.length > 0) {
    const keepIds = new Set([...(strippedEngine.summary ? [strippedEngine.summary.id] : []), ...strippedEngine.skills.map((s) => s.id), ...strippedEngine.roles.flatMap((r) => r.bullets.map((b) => b.id))]);
    doc = {
      ...doc,
      ...(doc.summary && !keepIds.has(doc.summary.id) ? { summary: undefined } : {}),
      skills: doc.skills.filter((s) => keepIds.has(s.id)),
      roles: doc.roles.map((r) => ({ ...r, bullets: r.bullets.filter((b) => keepIds.has(b.id)) })),
    };
    ledger = ledgerOf(doc, facts, asOf, leftOut);
  }

  const timeline = timelineOf(doc, facts, asOf);
  const suggestions = lint({ document: scoringDocumentOf(doc, args.contact), market: marketOf(jd) });
  return { document: doc, ledger, timeline, lint: suggestions, revisions, stripped, preStripViolations: Math.max(preStripViolations, firstViolations > 0 && revisions === 0 ? firstViolations : 0) };
}

/**
 * A tailored run (toreview §110.3): what the model wrote, validated, merged into the base version
 * by code (`tailorMerge.ts`); then the merged document's own ledger, timeline and lint, so the
 * record describes the document that is written. The base version is immutable (G12), so a
 * redelivered run merges into exactly the same lines.
 */
async function tailored(ctx: StageContext, run: RunInput, tailor: TailorRunInput, jd: StageJd | null, validated: ValidationOutput): Promise<ValidationOutput> {
  const row = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) => tx.selectFrom('resume_versions').select('content').where('id', '=', tailor.baseVersionId).executeTakeFirst());
  const parsed = canonicalResumeSchema.safeParse(row?.content);
  if (!parsed.success) throw new StageError('base_missing', 'The resume this was being tailored from is gone.');
  // The user's rewritten bullets are part of the base this run tailors (toreview §129).
  const base = withFigures(parsed.data, tailor.figures);
  const job = jd ? { title: jd.title, skills: [...jd.requiredSkills, ...jd.preferredSkills, ...jd.tools] } : null;
  const merged = mergeTailored({ base, generated: validated.document, request: tailor, job });
  const fit = await fitTailored(ctx, run, tailor, jd, base, merged);
  const document = fit.doc;
  const { facts, contact } = run.snapshot;
  const stripped = strippedInUse(validated.stripped, base, tailor);
  return {
    ...validated,
    document,
    ledger: ledgerOf(document, facts, run.asOf),
    timeline: timelineOf(document, facts, run.asOf),
    lint: lint({ document: scoringDocumentOf(document, contact), market: marketOf(jd) }),
    stripped,
    tailor: { baseVersionId: tailor.baseVersionId, pages: fit.pages, density: fit.density, pagesCompiled: fit.compiled, pageBasis: fit.basis, changes: changesOf({ base, final: document, request: tailor, stripped: stripped.length, pages: fit.pages }) },
  };
}

/**
 * The page budget (toreview §111.1): one page under five years of experience, else the uploaded
 * file's own count, at most two. Trimming is allowed with the length fix, and for a fresher, whose
 * resume is one page by the owner's rule; a compile outage falls back to the estimate.
 */
async function fitTailored(ctx: StageContext, run: RunInput, tailor: TailorRunInput, jd: StageJd | null, base: CanonicalResumeJson, merged: CanonicalResumeJson) {
  const budget = pageBudget(merged, { year: run.asOf.year, month: run.asOf.month ?? 12 }, tailor.sourceMeasured ? tailor.sourcePages : null);
  const fresher = budget.months < EXPERIENCED_MONTHS;
  const order = dropOrder(merged, recentRoleIds(base), jd ? [...jd.requiredSkills, ...jd.preferredSkills, ...jd.tools] : []);
  const args = { doc: merged, budget: budget.pages, order };
  if (ctx.latex) {
    try {
      const paper = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) => userPaper(tx, ctx.userId));
      const fit = await fitToPages({ ...args, mayTrim: fresher || tailor.fixes.includes('length'), measure: compiledMeasure(ctx.latex, jd?.location ?? null, paper), compiled: true });
      return { ...fit, basis: budget.basis };
    } catch {
      // The service is down or busy: the estimate below, which trims only with the length fix.
    }
  }
  const fit = await fitToPages({ ...args, mayTrim: tailor.fixes.includes('length'), measure: estimateMeasure, compiled: false });
  return { ...fit, basis: `${budget.basis} (estimated)` };
}

export const validateStage: StageDef = {
  name: 'validate',
  status: 'validating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const tailor = tailorOf(ctx.run);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const prompt = ctx.prompts[REVISE_TEMPLATE] ?? ctx.prompt;
    const result = await validateDocument({
      gateway: ctx.gateway,
      prompt,
      facts: run.snapshot.facts,
      plan: ctx.outputs.plan as ResumePlan,
      jd,
      asOf: run.asOf,
      contact: run.snapshot.contact,
      document: (ctx.outputs.generate as { document: CanonicalResumeJson }).document,
      context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: prompt.id },
      ...(tailor ? { leftOut: tailor.skipped } : {}),
    });
    await queueForReview(ctx.db, result.timeline.reviewQueue);
    const output: ValidationOutput = { document: result.document, ledger: result.ledger, timeline: result.timeline, lint: result.lint, revisions: result.revisions, stripped: result.stripped };
    return { output: tailor ? await tailored(ctx, run, tailor, jd, output) : output };
  },
};
