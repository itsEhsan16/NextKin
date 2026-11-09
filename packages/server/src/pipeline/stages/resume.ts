import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { evidenceOf } from '@nextkin/engines/document';
import type { ProfileFacts } from '@nextkin/engines/facts';
import { factIndex } from '@nextkin/engines/facts';
import { rubricById } from '@nextkin/engines/provenance';
import { buildLedger, requirementsFromJd } from '@nextkin/engines/requirements';
import { eraValidSkills } from '@nextkin/engines/timeline';
import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { z } from 'zod';

import type { VerifiedJd } from './extractJd';
import { isoOf, periodOf, profileDocument, readRun, type RunInput, type StageJd } from './common';
import { StageError, type StageDef } from '../stages';
import { headlineOf, skillKey, tailorOf } from './tailorMerge';
import type { Tx } from '../../db/database';

/**
 * The resume pipeline's first three stages (ImBackendImplementationPlan P9-03):
 * - `jd`: the confirmed JD (the user's corrections on top of the extraction);
 * - `plan`: a deterministic selection plan over fact ids — which skills each role may claim (the
 *   timeline pre-filter, §7.7) and which JD requirements the profile backs, and where;
 * - `generate`: the model writes the summary, skills and bullets, citing a fact id for every claim
 *   (M2-14). Employers, titles, dates and education are copied from the facts, never generated:
 *   titles are facts.
 */

export const RESUME_TEMPLATE = 'resume.generate';
export const REVISE_TEMPLATE = 'resume.revise';

const FULL_JD_WORDS = 80;

export const jdStage: StageDef = {
  name: 'jd',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    if (!run.jdId) return { output: null };
    const row = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) => readJdRow(tx, run.jdId!));
    if (!row) throw new StageError('jd_missing', 'The job description for this run is gone.');
    if (row.status === 'extracting') throw new Error('the job description is still being read'); // transient: redelivered
    if (row.status === 'failed') throw new StageError('jd_unreadable', 'The job description could not be read.');
    return { output: stageJdOf(row) };
  },
};

export const readJdRow = (tx: Tx, id: string) =>
  tx.selectFrom('job_descriptions').select(['id', 'raw_text', 'extracted', 'edited', 'status', 'language']).where('id', '=', id).executeTakeFirst();

/** A JD row as generation and scoring read it: the user's corrections on top of the extraction. */
export function stageJdOf(row: NonNullable<Awaited<ReturnType<typeof readJdRow>>>): StageJd {
  const x = (row.extracted ?? {}) as Partial<VerifiedJd>;
  const e = (row.edited ?? {}) as Partial<Record<keyof VerifiedJd, unknown>>;
  const pick = <T>(key: keyof VerifiedJd, fallback: T): T => (e[key] !== undefined ? (e[key] as T) : fallback);
  const jd: StageJd = {
    id: row.id,
    title: pick('title', x.title ?? null) ?? 'this role',
    company: pick('company', x.company ?? null),
    location: pick('location', x.location ?? null),
    requiredSkills: pick('requiredSkills', x.requiredSkills ?? []),
    preferredSkills: pick('preferredSkills', x.preferredSkills ?? []),
    tools: pick('tools', x.tools ?? []),
    responsibilities: pick('responsibilities', x.responsibilities ?? []),
    rawText: row.raw_text,
    completeness: row.raw_text.split(/\s+/).filter(Boolean).length >= FULL_JD_WORDS ? 'full' : 'snippet',
    language: (row.language as StageJd['language']) ?? x.language ?? null,
  };
  return jd;
}

export interface ResumePlan {
  roles: { roleId: string; allowedSkills: string[]; emphasis: string[] }[];
  /** JD requirements the profile backs, in JD order; the generator leads with these. */
  backed: string[];
  /** JD requirements the profile does not back: never written in (§7.8). */
  gaps: string[];
}

/** The pre-filter and the requirement ledger over the profile (deterministic, no model). */
export function planFor(facts: ProfileFacts, jd: StageJd | null, run: RunInput): ResumePlan {
  const allowed = eraValidSkills({
    roles: facts.roles.map((r) => ({
      id: r.id,
      start: r.start,
      end: r.end,
      skills: r.skills,
      text: [r.description ?? '', ...r.responsibilities].join('\n'),
    })),
    kb: KB,
    taxonomy: TAXONOMY,
    asOf: run.asOf,
  });
  const nameOf = new Map(TAXONOMY.skills.map((s) => [s.id, s.name]));
  let backed: string[] = [];
  let gaps: string[] = [];
  const emphasis = new Map<string, string[]>();
  if (jd) {
    const requirements = requirementsFromJd(
      {
        requiredSkills: jd.requiredSkills,
        preferredSkills: jd.preferredSkills,
        tools: jd.tools,
        rawText: jd.rawText,
      },
      TAXONOMY,
    );
    const phrases = requirements.flatMap((r) => (r.skill && !r.skill.known ? [r.skill.id] : []));
    const { evidence } = evidenceOf(profileDocument(facts, run.snapshot.contact), TAXONOMY, { minCopiedWords: 8, phrases });
    const ledger = buildLedger({
      requirements,
      evidence,
      rubric: rubricById(),
      asOf: run.asOf,
    });
    for (const entry of ledger.entries) {
      if (entry.kind !== 'skill') continue;
      if (entry.status === 'gap') gaps.push(entry.text);
      else backed.push(entry.text);
      for (const roleId of entry.roleIds) emphasis.set(roleId, [...(emphasis.get(roleId) ?? []), entry.text]);
    }
  }
  backed = [...new Set(backed)];
  gaps = [...new Set(gaps)];
  return {
    roles: facts.roles.map((r) => ({
      roleId: r.id,
      allowedSkills: (allowed[r.id] ?? []).map((id) => nameOf.get(id) ?? id.replace(/^x:/, '')),
      emphasis: emphasis.get(r.id) ?? [],
    })),
    backed,
    gaps,
  };
}

export const planStage: StageDef = {
  name: 'plan',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    return {
      output: planFor(run.snapshot.facts, (ctx.outputs.jd as StageJd | null) ?? null, run),
    };
  },
};

const cited = z.object({
  text: z.string().trim().min(1).max(400),
  evidence: z.array(z.string().max(80)).min(1).max(8),
});

/** What the model fills: claims with the fact ids they rest on. */
export const resumeDraftSchema = z.object({
  headline: z.string().trim().max(120).nullable(),
  summary: cited.nullable(),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        evidence: z.array(z.string().max(80)).min(1).max(5),
      }),
    )
    .max(30),
  roles: z.array(z.object({ roleId: z.string().max(80), bullets: z.array(cited).max(6) })).max(20),
  /** A tailored run's projects (toreview §113): each project's bullets, citing its own lines. */
  projects: z.array(z.object({ projectId: z.string().max(80), bullets: z.array(cited).max(6) })).max(10),
});
export type ResumeDraft = z.infer<typeof resumeDraftSchema>;

/**
 * How many bullets a role may have: one per stated line, at most 6; a role known only by its
 * description gets 3. A tailored run's facts are the base's own bullets, so it is never padded
 * past the original (toreview §111.6: a one-page resume came back two pages of filler).
 */
export const bulletCap = (r: ProfileFacts['roles'][number]): number =>
  Math.min(6, r.responsibilities.length > 0 ? r.responsibilities.length : r.description ? 3 : 0);

/** The generator's input: facts with ids, the plan, the JD's requirements. No contact field (G5). */
/**
 * Where each backed requirement earns full credit (§202, D-14): the roles whose facts back it. The
 * keyword checker gives a skill named in a dated role's bullet full credit, one only listed half,
 * so the writer and the reviewer are told which role can show each one. Never a role whose facts
 * don't back it: that is the plan's own `allowedSkills`. Pure.
 */
export function scoreTargetsOf(plan: ResumePlan): { skill: string; roles: string[] }[] {
  return plan.backed.flatMap((skill) => {
    const key = skillKey(skill);
    const roles = plan.roles.filter((r) => r.allowedSkills.some((a) => skillKey(a) === key)).map((r) => r.roleId);
    return roles.length ? [{ skill, roles }] : [];
  });
}

export function generationInput(
  facts: ProfileFacts,
  plan: ResumePlan,
  jd: StageJd | null,
  extra: { instruction?: string; keywordsToPlace?: readonly string[]; headline?: string } = {},
) {
  const index = factIndex(facts);
  const { instruction, keywordsToPlace = [], headline } = extra;
  return {
    // What the user asked for in "AI rewrite" (toreview §113): followed only within every rule.
    ...(instruction ? { instruction } : {}),
    target: jd
      ? {
          title: jd.title,
          company: jd.company,
          // The headline the resume will print, when a tailored run aims it (toreview §170): the
          // summary is written to agree with it.
          ...(headline ? { headline } : {}),
          requirementsBacked: plan.backed,
          requirementsNotBacked: plan.gaps,
          // Where each backed requirement scores in full (§202): a bullet of one of these roles.
          scoreTargets: scoreTargetsOf(plan),
          // The job's own duties, in its words (toreview §112): what to mirror where the facts agree.
          responsibilities: jd.responsibilities.slice(0, 30),
          // Ticked by the user as skills they have (toreview §116): the model places each one.
          ...(keywordsToPlace.length ? { keywordsToPlace: [...keywordsToPlace] } : {}),
        }
      : null,
    profile: {
      headline: facts.headline ?? null,
      summaryFactId: facts.summary ? 'profile#summary' : null,
      summary: facts.summary ?? null,
      listedSkills: facts.skills,
      roles: facts.roles.map((r) => {
        const p = plan.roles.find((x) => x.roleId === r.id);
        const ids = [...(r.description ? [`${r.id}#d`] : []), ...r.responsibilities.map((_, i) => `${r.id}#r${i}`)];
        return {
          roleId: r.id,
          title: r.title,
          company: r.company,
          period: periodOf(r),
          facts: ids.map((id) => ({ id, text: index.get(id)!.text })),
          maxBullets: bulletCap(r),
          allowedSkills: p?.allowedSkills ?? [],
          emphasise: p?.emphasis ?? [],
        };
      }),
      // Projects with citable lines (a tailored run's): rewritten like roles, never past their own lines.
      projects: facts.projects
        .filter((p) => p.lines?.length)
        .map((p) => ({
          projectId: p.id,
          name: p.name,
          facts: (p.lines ?? []).map((text, i) => ({ id: `${p.id}#p${i}`, text })),
          allowedSkills: [...(p.skills ?? [])],
          maxBullets: Math.min(6, p.lines?.length ?? 0),
        })),
    },
  };
}

/** Assembles the canonical resume: the model's claims under headers copied from the facts. */
export function assemble(facts: ProfileFacts, draft: ResumeDraft): CanonicalResumeJson {
  const known = new Set(facts.roles.map((r) => r.id));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    ...(draft.headline ? { headline: draft.headline } : {}),
    ...(draft.summary
      ? {
          summary: {
            id: 's',
            text: draft.summary.text,
            evidence: draft.summary.evidence,
            origin: 'generated' as const,
          },
        }
      : {}),
    skills: draft.skills.map((s, i) => ({
      id: `k${i}`,
      name: s.name,
      evidence: s.evidence,
      origin: 'generated' as const,
    })),
    roles: facts.roles.map((r, ri) => ({
      roleId: r.id,
      company: r.company,
      title: r.title,
      start: isoOf(r.start),
      end: r.end ? isoOf(r.end) : null,
      ...(r.location ? { location: r.location } : {}),
      skills: [...r.skills],
      bullets: (draft.roles.find((x) => x.roleId === r.id && known.has(x.roleId))?.bullets ?? []).slice(0, bulletCap(r)).map((b, bi) => ({
        id: `b${ri}-${bi}`,
        text: b.text,
        evidence: b.evidence,
        origin: 'generated' as const,
      })),
    })),
    education: facts.education.map((e) => ({
      factId: e.id,
      institution: e.institution,
      degree: e.degree,
      ...(e.field ? { field: e.field } : {}),
      start: isoOf(e.start),
      end: e.end === null ? null : isoOf(e.end),
    })),
    certifications: facts.certifications.map((c) => ({
      factId: c.id,
      name: c.name,
      issuer: c.issuer,
    })),
    projects: facts.projects.map((p, pi) => ({
      factId: p.id,
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      // Only a project with citable lines takes the model's bullets; the tailor merge checks them.
      bullets: p.lines?.length
        ? (draft.projects.find((x) => x.projectId === p.id)?.bullets ?? []).slice(0, Math.min(6, p.lines.length)).map((b, bi) => ({ id: `pj${pi}-${bi}`, text: b.text, evidence: b.evidence, origin: 'generated' as const }))
        : [],
    })),
  };
}

export const generateStage: StageDef = {
  name: 'generate',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const facts = run.snapshot.facts;
    if (facts.roles.length === 0) throw new StageError('profile_empty', 'Add at least one role to your profile to build a resume from it.');
    const plan = ctx.outputs.plan as ResumePlan;
    const prompt = ctx.prompts[RESUME_TEMPLATE] ?? ctx.prompt;
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const tailor = tailorOf(ctx.run);
    const headline = tailor?.fixes.includes('headline') && jd?.title ? headlineOf(jd.title) : undefined;
    const { data, meta } = await ctx.gateway.extract({
      stage: 'resume_generate',
      system: prompt.body.system.map((text) => ({ text })),
      input: generationInput(facts, plan, jd, { ...(run.instruction ? { instruction: run.instruction } : {}), keywordsToPlace: tailor?.added ?? [], ...(headline ? { headline } : {}) }),
      schema: resumeDraftSchema,
      name: 'resume',
      description: 'The resume: a summary, skills and bullets per role, each citing the fact ids it rests on.',
      context: {
        userId: ctx.userId,
        generationId: ctx.generationId,
        correlationId: ctx.correlationId,
        promptVersionId: prompt.id,
      },
    });
    return { output: { document: assemble(facts, data) }, meta };
  },
};
