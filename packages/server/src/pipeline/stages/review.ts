import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { leftOutChecker } from '@nextkin/engines/leftOut';
import { lint } from '@nextkin/engines/lint';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { scoringDocumentOf } from '@nextkin/shared/scoring/canonical';
import { headerStatements } from '@nextkin/shared/scoring/headerChecks';
import { EXPERIENCED_MONTHS, pageBudget } from '@nextkin/shared/scoring/pageBudget';

import { userPaper } from '../../services/renders';
import { StageError, type StageContext, type StageDef } from '../stages';
import { periodOf, readRun, type RunInput, type StageJd } from './common';
import { compiledMeasure, dropOrder, estimateMeasure, fitToPages } from './pageFit';
import { generationInput, type ResumePlan } from './resume';
import { applyReview, emptyReview, reviewSchema, type ReviewRecord } from './reviewEdits';
import { changesOf } from './tailorChanges';
import { recentRoleIds, rewrittenRoles, skillKey, tailorOf, type TailorRunInput } from './tailorMerge';
import { ledgerOf, marketOf, readTailorBase, timelineOf, type ValidationOutput } from './validate';

/**
 * The review (toreview §170): on a tailored run, the model reads the whole merged resume beside the
 * job and proposes edits; `reviewEdits.ts` applies those that pass their checks. Then the page fit,
 * and the ledger, timeline, lint and "what changed" of the document that is written. Any other run
 * passes through. A review that cannot run (no job, a model error) leaves the merge's document: it
 * only ever improves a resume that is already valid.
 */

export const REVIEW_TEMPLATE = 'resume.review';

/** What the reviewer reads: the job, the whole page (contact hidden, G5), and the facts it may cite. */
export function reviewInput(doc: CanonicalResumeJson, args: { run: RunInput; plan: ResumePlan; jd: StageJd; tailor: TailorRunInput; base: CanonicalResumeJson }) {
  const { run, plan, jd, tailor, base } = args;
  const ticked = new Set(tailor.added.map(skillKey));
  const work = [...doc.roles.flatMap((r) => r.bullets), ...doc.projects.flatMap((p) => p.bullets)].map((b) => b.text).join('\n');
  const shown = new Set(leftOutChecker(TAXONOMY, doc.skills.map((s) => s.name))(work).map(skillKey));
  const grouped = new Set((doc.skillGroups ?? []).flatMap((g) => g.names.map((n) => n.toLowerCase())));
  const skill = (name: string) => ({ name, ticked: ticked.has(skillKey(name)), shownInWork: shown.has(skillKey(name)) });
  const fact = (id: string) => run.snapshot.facts.roles.find((r) => r.id === id);
  return {
    job: { title: jd.title, company: jd.company, location: jd.location, requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, tools: jd.tools, responsibilities: jd.responsibilities.slice(0, 30) },
    // What this run may change (the user switched the rest off): edits elsewhere are refused.
    parts: { summary: tailor.fixes.includes('summary'), skills: tailor.fixes.includes('skills'), projects: tailor.fixes.includes('projects'), rolesToRewrite: [...rewrittenRoles(base, tailor)] },
    leftOut: tailor.skipped,
    resume: {
      headline: doc.headline ?? null,
      headerStatements: headerStatements(doc.header),
      summary: doc.summary?.text ?? null,
      skillLines: (doc.skillGroups ?? []).map((g) => ({ label: g.label, skills: g.names.map(skill) })),
      otherSkills: doc.skills.filter((s) => !grouped.has(s.name.toLowerCase())).map((s) => skill(s.name)),
      sections: (doc.layout?.order ?? []).map((key) => ({ key, heading: doc.layout?.headings[key] ?? key })),
      roles: doc.roles.map((r) => ({ roleId: r.roleId, title: r.title, company: r.company, period: fact(r.roleId) ? periodOf(fact(r.roleId)!) : null, bullets: r.bullets.map((b) => ({ id: b.id, text: b.text })) })),
      projects: doc.projects.map((p) => ({ projectId: p.factId, name: p.name, ...(p.tech ? { tech: p.tech } : {}), bullets: p.bullets.map((b) => ({ id: b.id, text: b.text })) })),
    },
    // The facts every rewrite must cite (the base version's own lines), as the writer saw them.
    facts: generationInput(run.snapshot.facts, plan, jd).profile,
  };
}

export const reviewStage: StageDef = {
  name: 'review',
  status: 'validating',
  async run(ctx) {
    const validated = ctx.outputs.validate as ValidationOutput;
    const tailor = tailorOf(ctx.run);
    if (!tailor) return { output: validated };
    const run = readRun(ctx.run);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const base = await readTailorBase(ctx, tailor);
    const prompt = ctx.prompts[REVIEW_TEMPLATE];
    let doc = validated.document;
    let record: ReviewRecord;
    let meta;
    if (!prompt || !jd) record = emptyReview(prompt ? 'no_job' : 'no_prompt');
    else {
      try {
        const answer = await ctx.gateway.extract({
          stage: 'resume_review',
          system: prompt.body.system.map((text) => ({ text })),
          input: reviewInput(doc, { run, plan: ctx.outputs.plan as ResumePlan, jd, tailor, base }),
          schema: reviewSchema,
          name: 'review',
          description: 'Edits to the whole tailored resume, each with its reason; code checks every one.',
          context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: prompt.id },
        });
        meta = answer.meta;
        ({ doc, record } = applyReview(doc, answer.data, { base, facts: run.snapshot.facts, tailor, asOf: run.asOf }));
      } catch (error) {
        if (error instanceof StageError) throw error;
        record = emptyReview('model_error');
      }
    }
    const output = await finish(ctx, run, tailor, jd, base, doc, validated, record);
    return { output, ...(meta ? { meta } : {}) };
  },
};

/** The page fit, then the record of the document that is written (toreview §110.3, §111). */
async function finish(ctx: StageContext, run: RunInput, tailor: TailorRunInput, jd: StageJd | null, base: CanonicalResumeJson, doc: CanonicalResumeJson, validated: ValidationOutput, review: ReviewRecord): Promise<ValidationOutput> {
  const fit = await fitTailored(ctx, run, tailor, jd, base, doc);
  const document = fit.doc;
  const { facts, contact } = run.snapshot;
  return {
    ...validated,
    document,
    ledger: ledgerOf(document, facts, run.asOf),
    timeline: timelineOf(document, facts, run.asOf),
    lint: lint({ document: scoringDocumentOf(document, contact), market: marketOf(jd) }),
    tailor: {
      baseVersionId: tailor.baseVersionId,
      pages: fit.pages,
      density: fit.density,
      pagesCompiled: fit.compiled,
      pageBasis: fit.basis,
      review,
      changes: changesOf({ base, final: document, request: tailor, stripped: validated.stripped.length, pages: fit.pages, review }),
    },
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
