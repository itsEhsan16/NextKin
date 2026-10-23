import { buildClaimLedger } from '@nextkin/engines/claims';
import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { numbersIn } from '@nextkin/engines/numbers';
import { atsCheckFrom } from '@nextkin/shared/scoring/atsCheck';
import { PARSE_SAFE_TEMPLATE } from '@nextkin/shared/scoring/adapters';
import { scoringDocumentOf } from '@nextkin/shared/scoring/canonical';
import { scoreDocument, type DocumentScore } from '@nextkin/shared/scoring/report';
import type { ProfileFacts } from '@nextkin/engines/facts';
import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { z } from 'zod';

import { StageError, type StageDef } from '../stages';
import { periodOf, readRun, type StageJd } from './common';
import { writeReport, writeVersion } from './persist';

/**
 * The other kinds' stages (ImBackendImplementationPlan P9-03):
 * - **zero_resume** (§7.9): drafted from the seed alone; every claim is `assumed`, employers and
 *   institutions are placeholders, and any figure becomes "[N]" — nothing invented is stated as a
 *   fact. No score (D-15: written for no job). Export stays blocked until the user resolves it.
 * - **cover_letter** (§7.10): written from a resume version, each paragraph citing its facts and
 *   checked by the claim ledger; a paragraph still violating after one rewrite is dropped.
 * - **ats_check** (§7.8): scores an existing version on its own terms (no profile yardstick).
 */

export const ZERO_TEMPLATE = 'zero.generate';
export const COVER_TEMPLATE = 'cover.write';

const zeroDraftSchema = z.object({
  headline: z.string().trim().max(120),
  summary: z.string().trim().min(1).max(600),
  skills: z.array(z.string().trim().min(1).max(80)).max(20),
  roles: z.array(z.object({ title: z.string().trim().min(1).max(120), startYearsAgo: z.number().int().min(0).max(50), endYearsAgo: z.number().int().min(0).max(50).nullable(), bullets: z.array(z.string().trim().min(1).max(300)).max(5) })).max(6),
  education: z.array(z.object({ degree: z.string().trim().min(1).max(160) })).max(3),
});

/** Every figure in an assumed claim becomes a placeholder: the draft states nothing as measured. */
const placeholderNumbers = (text: string) =>
  numbersIn(text, TAXONOMY)
    .sort((a, b) => b.start - a.start)
    .reduce((out, n) => out.slice(0, n.start) + '[N]' + out.slice(n.end), text);

export const zeroStage: StageDef = {
  name: 'zero',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const seed = run.zero;
    if (!seed) throw new StageError('zero_seed', 'A Zero Resume needs the years of experience.');
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const prompt = ctx.prompts[ZERO_TEMPLATE] ?? ctx.prompt;
    // The seed's name never reaches the model (G5): only the years, the target and the JD.
    const { data, meta } = await ctx.gateway.extract({
      stage: 'zero_generate',
      system: prompt.body.system.map((text) => ({ text })),
      input: { yearsExperience: seed.yearsExperience, targetTitle: (seed as { targetTitle?: string }).targetTitle ?? jd?.title ?? null, requirements: jd ? [...jd.requiredSkills, ...jd.preferredSkills] : [] },
      schema: zeroDraftSchema,
      name: 'zero_resume',
      description: 'A first-draft resume from the seed alone, every line an assumption for the user to confirm.',
      context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: prompt.id },
    });
    const year = run.asOf.year;
    const doc: CanonicalResumeJson = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      headline: data.headline,
      summary: { id: 's', text: placeholderNumbers(data.summary), evidence: [], origin: 'assumed' },
      skills: data.skills.map((name, i) => ({ id: `k${i}`, name, evidence: [], origin: 'assumed' as const })),
      roles: data.roles.map((r, ri) => ({
        roleId: `assumed-r${ri}`,
        company: '[Company Name]',
        title: r.title,
        start: String(year - r.startYearsAgo),
        end: r.endYearsAgo === null ? null : String(year - r.endYearsAgo),
        skills: [],
        bullets: r.bullets.map((text, bi) => ({ id: `b${ri}-${bi}`, text: placeholderNumbers(text), evidence: [], origin: 'assumed' as const })),
        assumed: true as const,
      })),
      education: data.education.map((e, i) => ({ factId: `assumed-e${i}`, institution: '[Institution Name]', degree: e.degree, assumed: true as const })),
      certifications: [],
      projects: [],
      // ZERO 03's checklist (P10-10): each role and its company, each skill claim, each school.
      review: { total: data.roles.length * 2 + data.skills.length + data.education.length, roles: data.roles.length, education: data.education.length, skills: [...data.skills], removedSkills: [] },
    };
    return { output: { document: canonicalResumeSchema.parse(doc) }, meta };
  },
};

export const zeroPersistStage: StageDef = {
  name: 'persist',
  status: 'validating',
  async run(ctx) {
    const doc = (ctx.outputs.zero as { document: CanonicalResumeJson }).document;
    const assumed = 1 + doc.skills.length + doc.roles.reduce((n, r) => n + r.bullets.length, 0);
    const written = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) =>
      writeVersion(tx, { generationId: ctx.generationId, userId: ctx.userId, content: doc, claimLedger: { version: 'claims-1', assumed }, note: 'Zero Resume draft: every line needs your confirmation' }),
    );
    return { output: { resumeId: written.resumeId, versionId: written.versionId, assumed } };
  },
};

/** The resume version a letter or a check is written from (the source must be a server document). */
export const sourceStage: StageDef = {
  name: 'source',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    if (!run.sourceResumeId) throw new StageError('no_source', 'Choose the resume this is written from.');
    const row = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) =>
      tx
        .selectFrom('resumes as r')
        .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.id', 'r.title', 'v.id as version_id', 'v.content'])
        .where('r.id', '=', run.sourceResumeId!)
        .executeTakeFirst(),
    );
    if (!row) throw new StageError('no_source', 'That resume is not available.');
    const parsed = canonicalResumeSchema.safeParse(row.content);
    if (!parsed.success) throw new StageError('no_source', 'That document is not a resume.');
    return { output: { resumeId: row.id, versionId: row.version_id, document: parsed.data } };
  },
};

const coverSchema = z.object({ greeting: z.string().trim().min(1).max(120), paragraphs: z.array(z.object({ text: z.string().trim().min(1).max(900), evidence: z.array(z.string().max(80)).min(1).max(10) })).min(1).max(5) });

/**
 * The facts a letter may draw on (P10-09, §7.10): only what its source resume shows. Roles the resume
 * leaves out are gone; a role's description and responsibilities stay only where the resume cites
 * them (blanked in place, so fact ids keep their numbers); skills, schools, certifications and
 * projects only when the resume lists them. A line the user typed has no fact behind it, so a letter
 * cannot cite it either.
 */
export function factsInResume(facts: ProfileFacts, doc: CanonicalResumeJson): ProfileFacts {
  const cited = new Set([...(doc.summary?.evidence ?? []), ...doc.skills.flatMap((s) => s.evidence), ...doc.roles.flatMap((r) => r.bullets.flatMap((b) => b.evidence)), ...doc.projects.flatMap((p) => p.bullets.flatMap((b) => b.evidence))]);
  const shown = new Set(doc.roles.map((r) => r.roleId));
  const listed = new Set([...doc.skills.map((s) => s.name.toLowerCase()), ...doc.roles.flatMap((r) => r.skills.map((s) => s.toLowerCase()))]);
  return {
    ...(facts.headline ? { headline: facts.headline } : {}),
    ...(facts.summary && cited.has('profile#summary') ? { summary: facts.summary } : {}),
    skills: facts.skills.filter((s) => listed.has(s.toLowerCase())),
    roles: facts.roles
      .filter((r) => shown.has(r.id))
      .map(({ description, ...r }) => ({ ...r, ...(description && cited.has(`${r.id}#d`) ? { description } : {}), responsibilities: r.responsibilities.map((t, i) => (cited.has(`${r.id}#r${i}`) ? t : '')) })),
    education: facts.education.filter((e) => doc.education.some((d) => d.factId === e.id)),
    certifications: facts.certifications.filter((c) => doc.certifications.some((d) => d.factId === c.id)),
    projects: facts.projects.filter((p) => doc.projects.some((d) => d.factId === p.id)),
  };
}

export const coverStage: StageDef = {
  name: 'letter',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const facts = factsInResume(run.snapshot.facts, (ctx.outputs.source as { document: CanonicalResumeJson }).document);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const prompt = ctx.prompts[COVER_TEMPLATE] ?? ctx.prompt;
    const input = {
      tone: run.tone ?? 'professional',
      target: jd ? { title: jd.title, company: jd.company, requirements: [...jd.requiredSkills, ...jd.preferredSkills] } : null,
      roles: facts.roles.map((r) => ({ roleId: r.id, title: r.title, company: r.company, period: periodOf(r), facts: [...(r.description ? [{ id: `${r.id}#d`, text: r.description }] : []), ...r.responsibilities.map((text, i) => ({ id: `${r.id}#r${i}`, text })).filter((f) => f.text)] })),
    };
    const call = (extra: object) =>
      ctx.gateway.extract({
        stage: 'cover_write',
        system: prompt.body.system.map((text) => ({ text })),
        input: { ...input, ...extra },
        schema: coverSchema,
        name: 'cover_letter',
        description: 'A cover letter: a greeting and paragraphs, each citing the fact ids it rests on.',
        context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: prompt.id },
      });
    const check = (paragraphs: z.infer<typeof coverSchema>['paragraphs']) =>
      paragraphs.map((p, i) => {
        const ledger = buildClaimLedger({ document: { summary: { id: `p${i}`, text: p.text, evidence: p.evidence, origin: 'generated' }, skills: [], roles: [], education: [], certifications: [], projects: [] }, facts, taxonomy: TAXONOMY, kb: KB, asOf: run.asOf });
        return { paragraph: p, ok: ledger.counts.violations === 0, issues: ledger.results.flatMap((r) => r.issues.map((x) => x.detail)) };
      });
    let { data, meta } = await call({});
    let checked = check(data.paragraphs);
    let revised = false;
    if (checked.some((c) => !c.ok)) {
      revised = true;
      ({ data, meta } = await call({ failures: checked.filter((c) => !c.ok).map((c) => ({ text: c.paragraph.text, issues: c.issues })) }));
      checked = check(data.paragraphs);
    }
    const kept = checked.filter((c) => c.ok).map((c, i) => ({ id: `p${i}`, text: c.paragraph.text, evidence: c.paragraph.evidence, origin: 'generated' as const }));
    if (kept.length === 0) throw new StageError('letter_unbacked', 'We could not write a letter your profile backs. Add more detail to your roles and try again.');
    return { output: { letter: { kind: 'cover_letter', schemaVersion: 1, tone: input.tone, greeting: data.greeting, paragraphs: kept, signoff: 'Regards,' }, dropped: checked.length - kept.length, revised }, meta };
  },
};

export const coverPersistStage: StageDef = {
  name: 'persist',
  status: 'validating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const out = ctx.outputs.letter as { letter: { tone: string } };
    const source = ctx.outputs.source as { resumeId: string; versionId: string };
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const written = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, async (tx) => {
      const v = await writeVersion(tx, { generationId: ctx.generationId, userId: ctx.userId, content: out.letter, note: 'Cover letter' });
      if (v.created) {
        await tx
          .insertInto('cover_letters')
          .values({ user_id: ctx.userId, resume_id: v.resumeId, source_version_id: source.versionId, generation_id: ctx.generationId, job_description_id: jd?.id ?? null, tone: run.tone ?? 'professional', content: JSON.stringify(out.letter) })
          .execute();
      }
      return v;
    });
    return { output: { resumeId: written.resumeId, versionId: written.versionId } };
  },
};

export const atsScoreStage: StageDef = {
  name: 'score',
  status: 'scoring',
  async run(ctx) {
    const run = readRun(ctx.run);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const source = ctx.outputs.source as { document: CanonicalResumeJson };
    // A check reads the document on its own terms: its own dated roles are the yardstick (G16).
    const result = scoreDocument({
      document: scoringDocumentOf(source.document, run.snapshot.contact),
      format: PARSE_SAFE_TEMPLATE,
      asOf: run.asOf,
      ...(jd ? { jd: { requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, tools: jd.tools, rawText: jd.rawText, completeness: jd.completeness } } : {}),
    });
    return { output: result };
  },
};

export const atsPersistStage: StageDef = {
  name: 'persist',
  status: 'scoring',
  async run(ctx) {
    const result = ctx.outputs.score as DocumentScore;
    const source = ctx.outputs.source as { resumeId: string; versionId: string };
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, async (tx) => {
      const done = await tx.selectFrom('ats_reports').select('id').where('generation_id', '=', ctx.generationId).executeTakeFirst();
      if (!done) await writeReport(tx, { userId: ctx.userId, versionId: source.versionId, generationId: ctx.generationId, result, hasJd: jd !== null });
    });
    const atsCheck = jd ? atsCheckFrom({ result, resume: {}, draft: { title: jd.title, ...(jd.company ? { company: jd.company } : {}) } }) : undefined;
    return { output: { resumeId: source.resumeId, versionId: source.versionId, ...(atsCheck ? { atsCheck } : {}) } };
  },
};

