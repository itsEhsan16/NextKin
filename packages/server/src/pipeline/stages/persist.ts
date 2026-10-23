import { createHash } from 'node:crypto';

import { canonicalJson } from '@nextkin/engines/canonical';
import type { PartialDate } from '@nextkin/engines/dates';
import type { FormatFacts } from '@nextkin/engines/document';
import type { ProfileFacts } from '@nextkin/engines/facts';
import type { TargetPathOptions } from '@nextkin/engines/targetPlan';
import { PARSE_SAFE_TEMPLATE, type ContactPresence } from '@nextkin/shared/scoring/adapters';
import { jobMatchOf, keywordsFrom } from '@nextkin/shared/scoring/tailorComparison';
import { scoringDocumentOf } from '@nextkin/shared/scoring/canonical';
import { scoreDocument, type DocumentScore, type ScoringJd } from '@nextkin/shared/scoring/report';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import type { Tx } from '../../db/database';
import { CURRENT_RUBRIC_VERSION_ID } from '../../seed/reference';
import type { LatexDensity } from '../../export/latex/types';
import { queueRender } from '../../services/renders';
import { StageError, type StageDef } from '../stages';
import { profileDocument, readRun, type StageJd } from './common';
import type { ValidationOutput } from './validate';

/**
 * Scoring and persistence (ImBackendImplementationPlan P9-03; V2 §7.8, §7.11).
 * - `score` runs the rubric engine (P8) on the validated document: against the JD when there is
 *   one, with the profile as the yardstick (G16); with no JD, parts and no total (D-15).
 * - `persist` writes an immutable version (the canonical JSON, its claim ledger and its timeline
 *   report, G12) and its ATS report, in one transaction as the owner. It is idempotent: a
 *   redelivered run that already wrote its version reuses it.
 */

/**
 * The one measure (G16): a document against a JD, with the facts it was written from as the
 * yardstick. Tailoring's comparison (W-TAILOR 01) scores the base with it too, with the base's own
 * lines as the facts, so "Up from N" compares like with like.
 */
export const scoreAgainst = (args: { document: CanonicalResumeJson; facts: ProfileFacts; contact: ContactPresence; jd: ScoringJd | null; asOf: PartialDate; format?: FormatFacts; path?: TargetPathOptions }): DocumentScore =>
  scoreDocument({
    document: scoringDocumentOf(args.document, args.contact),
    // A NextKin document downloads in one of its templates, built to these facts and read back on
    // every PDF download (toreview §130). An uploaded file, compared as the user would send it,
    // brings what it was measured to be (`parsing/layout.ts`).
    format: args.format ?? PARSE_SAFE_TEMPLATE,
    asOf: args.asOf,
    ...(args.jd ? { jd: args.jd } : {}),
    profile: profileDocument(args.facts, args.contact),
    ...(args.path ? { path: args.path } : {}),
  });

export const scoringJdOfStage = (jd: StageJd): ScoringJd => ({ requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, tools: jd.tools, rawText: jd.rawText, completeness: jd.completeness });

export const scoreStage: StageDef = {
  name: 'score',
  status: 'scoring',
  async run(ctx) {
    const run = readRun(ctx.run);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const doc = (ctx.outputs.validate as ValidationOutput).document;
    const result = scoreAgainst({ document: doc, facts: run.snapshot.facts, contact: run.snapshot.contact, jd: jd ? scoringJdOfStage(jd) : null, asOf: run.asOf });
    return { output: result };
  },
};

export const contentHashOf = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

/** The run's resume, and its version for this generation if one was already written. */
async function target(tx: Tx, generationId: string) {
  const gen = await tx.selectFrom('generations').select(['resume_id']).where('id', '=', generationId).executeTakeFirstOrThrow();
  if (!gen.resume_id) throw new StageError('no_document', 'This run has no document to write to.');
  const existing = await tx.selectFrom('resume_versions').select(['id']).where('generation_id', '=', generationId).executeTakeFirst();
  return { resumeId: gen.resume_id, existing: existing?.id ?? null };
}

/** Writes the version (and makes it current); returns its id. */
export async function writeVersion(
  tx: Tx,
  args: { generationId: string; userId: string; content: object; claimLedger?: unknown; timeline?: unknown; note: string; createdBy?: 'generation'; density?: LatexDensity },
): Promise<{ resumeId: string; versionId: string; created: boolean }> {
  const { resumeId, existing } = await target(tx, args.generationId);
  if (existing) return { resumeId, versionId: existing, created: false };
  const last = await tx.selectFrom('resume_versions').select((eb) => eb.fn.max('version_number').as('max')).where('resume_id', '=', resumeId).executeTakeFirst();
  const version = await tx
    .insertInto('resume_versions')
    .values({
      resume_id: resumeId,
      user_id: args.userId,
      generation_id: args.generationId,
      version_number: Number(last?.max ?? 0) + 1,
      content: JSON.stringify(args.content),
      content_hash: contentHashOf(args.content),
      claim_ledger: args.claimLedger === undefined ? null : JSON.stringify(args.claimLedger),
      timeline_validation_result: args.timeline === undefined ? null : JSON.stringify(args.timeline),
      created_by: args.createdBy ?? 'generation',
      change_note: args.note,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const resume = await tx.updateTable('resumes').set({ current_version_id: version.id }).where('id', '=', resumeId).returning('doc_type').executeTakeFirstOrThrow();
  // Every resume version is typeset on the worker (toreview §111); a cover letter is not.
  // A tailored run's fit chose its spacing; the render starts there (toreview §111.6).
  if (resume.doc_type === 'resume') await queueRender(tx, { userId: args.userId, resumeId, versionId: version.id, ...(args.density !== undefined ? { density: args.density } : {}) });
  return { resumeId, versionId: version.id, created: true };
}

/** The ATS report beside its version (Q-01: keyed by version, with the generation). */
export async function writeReport(tx: Tx, args: { userId: string; versionId: string; generationId: string | null; result: DocumentScore; hasJd: boolean }): Promise<void> {
  const { report, score } = args.result;
  await tx
    .insertInto('ats_reports')
    .values({
      user_id: args.userId,
      resume_version_id: args.versionId,
      generation_id: args.generationId,
      rubric_version_id: CURRENT_RUBRIC_VERSION_ID,
      reason: report.provenance.reason,
      has_jd: args.hasJd,
      total_bps: args.hasJd && report.total !== null ? report.total * 100 : null,
      jd_match_bps: args.hasJd && report.jdMatch ? report.jdMatch.percent * 100 : null,
      components: JSON.stringify(report.components),
      requirement_ledger: JSON.stringify(report.requirements),
      suggestions: JSON.stringify(report.fixes),
      basis: JSON.stringify({ panel: score ?? null, report, validation: args.result.validation, completeness: args.result.completeness }),
      provenance: JSON.stringify(report.provenance),
    })
    .execute();
}

export const persistStage: StageDef = {
  name: 'persist',
  status: 'scoring',
  async run(ctx) {
    const validation = ctx.outputs.validate as ValidationOutput;
    const result = (ctx.outputs.score as DocumentScore | undefined) ?? null;
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const doc: CanonicalResumeJson = validation.document;
    const tailor = validation.tailor;
    const forJob = jd ? `for ${jd.title}${jd.company ? ` at ${jd.company}` : ''}` : '';
    const written = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, async (tx) => {
      const v = await writeVersion(tx, {
        generationId: ctx.generationId,
        userId: ctx.userId,
        content: doc,
        // A tailored version's claims cite the base version's lines, not the profile: say so.
        claimLedger: tailor ? { ...validation.ledger, basis: { kind: 'document', versionId: tailor.baseVersionId } } : validation.ledger,
        timeline: validation.timeline,
        ...(tailor?.density !== undefined ? { density: tailor.density } : {}),
        note: tailor ? `Tailored ${forJob}`.trim() : jd ? `Generated ${forJob}` : 'Generated from your profile',
      });
      if (v.created && result) await writeReport(tx, { userId: ctx.userId, versionId: v.versionId, generationId: ctx.generationId, result, hasJd: jd !== null });
      if (v.created && jd) {
        await tx.updateTable('resumes').set({ target_role: jd.title.slice(0, 200), ...(jd.company ? { target_company: jd.company.slice(0, 200) } : {}) }).where('id', '=', v.resumeId).execute();
      }
      return v;
    });
    // A tailored run's result, for its ready screen (W-TAILOR 04): read by `toSnapshot`.
    // The job match is counted on the new version's ledger, against the JD the comparison used (§112).
    const jobMatch = tailor && result && jd ? jobMatchOf(keywordsFrom(result, jd.rawText, jd.title)) : undefined;
    const tailored = tailor ? { ...(result?.score ? { score: result.score.total } : {}), changes: tailor.changes, pages: tailor.pages, ...(tailor.pageBasis ? { pageBasis: tailor.pageBasis } : {}), ...(jobMatch ? { jobMatch } : {}), stripped: validation.stripped.length } : undefined;
    return { output: { resumeId: written.resumeId, versionId: written.versionId, stripped: validation.stripped.length, revisions: validation.revisions, ...(tailored ? { tailor: tailored } : {}) } };
  },
};
