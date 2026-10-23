import { fromBank, INTERVIEW_SET_MAX, INTERVIEW_SET_MIN } from '@nextkin/shared/interview/bank';
import type { InterviewQuestion } from '@nextkin/shared/models/interview';
import { PARSE_SAFE_TEMPLATE } from '@nextkin/shared/scoring/adapters';
import { scoringDocumentOf } from '@nextkin/shared/scoring/canonical';
import { scoreDocument } from '@nextkin/shared/scoring/report';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { z } from 'zod';

import { StageError, type StageDef } from '../stages';
import { readRun, type StageJd } from './common';

/**
 * Interview practice sets (ImBackendImplementationPlan P11-08; V2 §7.15).
 *
 * | Stage | What it does |
 * |---|---|
 * | source | the resume the set is about (optional: no resume is the standalone, generic mode) |
 * | jd | the JD the resume was made for, when it has one (`jdStage`) |
 * | ground | deterministic: the skills a technical question may be about, and the ones it may never touch |
 * | write | the model writes questions, model answers and talking points |
 * | check | deterministic (G14): drops what breaks the grounding, pads from the bank to 10–20 |
 * | persist | the set, once per run, and its activity entry |
 *
 * §7.15: "questions are never generated about skills the Timeline Validation Engine flagged or
 * removed". The model is told the eligible skills, and code then removes anything that strays:
 * a technical question about any other skill, and any question that names an excluded one.
 */

export const INTERVIEW_TEMPLATE = 'interview.write';

export interface InterviewGround {
  mode: 'resume' | 'standalone';
  roleTitle: string;
  company: string | null;
  resumeTitle: string | null;
  /** Claimed by the resume, asked by the JD when there is one, not flagged: what technical questions may cover. */
  eligibleSkills: string[];
  /** Flagged by the timeline engine or a JD requirement the resume does not back: never in a question. */
  excludedSkills: string[];
  responsibilities: string[];
  roles: { title: string; company: string }[];
}

const lower = (value: string) => value.trim().toLowerCase();
const uniqueBy = (list: readonly string[]) => list.filter((item, i) => list.findIndex((other) => lower(other) === lower(item)) === i);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a text names a skill as a whole term ("Go" is not in "good"; "C++" and "Node.js" are terms). */
export function mentions(text: string, skill: string): boolean {
  const term = skill.trim();
  if (!term) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}+#.])${escape(term)}(?=$|[^\\p{L}\\p{N}+#]|\\.(?!\\p{L}))`, 'iu').test(text);
}

export const interviewSourceStage: StageDef = {
  name: 'source',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    if (!run.sourceResumeId) return { output: null };
    const row = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, (tx) =>
      tx
        .selectFrom('resumes as r')
        .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
        .select(['r.id', 'r.title', 'v.id as version_id', 'v.content'])
        .where('r.id', '=', run.sourceResumeId!)
        .where('r.trashed_at', 'is', null)
        .executeTakeFirst(),
    );
    if (!row) throw new StageError('no_source', 'That resume is not available.');
    const content = row.content as Partial<CanonicalResumeJson> | null;
    if (!content || !Array.isArray(content.skills) || !Array.isArray(content.roles)) throw new StageError('no_source', 'Interview practice is written from a resume.');
    return { output: { resumeId: row.id, title: row.title, versionId: row.version_id, document: content as CanonicalResumeJson } };
  },
};

export const interviewGroundStage: StageDef = {
  name: 'ground',
  status: 'generating',
  async run(ctx) {
    const run = readRun(ctx.run);
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const source = (ctx.outputs.source as { title: string; document: CanonicalResumeJson } | null) ?? null;
    const responsibilities = (jd?.responsibilities ?? []).slice(0, 6);
    if (!source) {
      const roleTitle = (run.title ?? jd?.title ?? 'Interview practice').trim().slice(0, 120);
      const ground: InterviewGround = { mode: 'standalone', roleTitle, company: null, resumeTitle: null, eligibleSkills: [], excludedSkills: [], responsibilities, roles: [] };
      return { output: ground };
    }
    const doc = source.document;
    // The same engines the ATS score runs: the timeline's excluded claims and the JD's unbacked requirements.
    const result = scoreDocument({
      document: scoringDocumentOf(doc, run.snapshot.contact),
      format: PARSE_SAFE_TEMPLATE,
      asOf: run.asOf,
      ...(jd ? { jd: { requiredSkills: jd.requiredSkills, preferredSkills: jd.preferredSkills, tools: jd.tools, rawText: jd.rawText, completeness: jd.completeness } } : {}),
    });
    const flagged = result.report.timeline.flags.filter((f) => f.verdict !== 'unverified').map((f) => f.skill);
    const gaps = result.report.requirements.filter((r) => r.status === 'gap').map((r) => r.text);
    const excluded = uniqueBy([...flagged, ...gaps]);
    const claimed = uniqueBy([...doc.skills.map((s) => s.name), ...doc.roles.flatMap((r) => r.skills)]);
    const isClaimed = (skill: string) => claimed.some((c) => lower(c) === lower(skill));
    const isExcluded = (skill: string) => excluded.some((x) => lower(x) === lower(skill));
    // With a JD: what it asks for that the resume claims, required first. Without: every claim.
    const asked = jd ? [...jd.requiredSkills, ...jd.preferredSkills, ...jd.tools] : claimed;
    const eligible = uniqueBy(asked.filter((s) => isClaimed(s) && !isExcluded(s))).slice(0, INTERVIEW_SET_MAX / 2);
    const ground: InterviewGround = {
      mode: 'resume',
      roleTitle: (jd?.title ?? doc.headline ?? source.title).trim().slice(0, 120),
      company: jd?.company ?? null,
      resumeTitle: source.title,
      eligibleSkills: eligible,
      excludedSkills: excluded,
      responsibilities,
      roles: doc.roles.filter((r) => !r.assumed).slice(0, 3).map((r) => ({ title: r.title, company: r.company })),
    };
    return { output: ground };
  },
};

const draftSchema = z.object({
  questions: z
    .array(
      z.object({
        kind: z.enum(['behavioural', 'technical']),
        skill: z.string().trim().max(120).nullable(),
        prompt: z.string().trim().min(1).max(1000),
        answer: z.string().trim().min(1).max(4000),
        talkingPoints: z.array(z.string().trim().min(1).max(600)).max(8),
      }),
    )
    .max(INTERVIEW_SET_MAX + 4),
});
type Draft = z.infer<typeof draftSchema>;

export const interviewWriteStage: StageDef = {
  name: 'write',
  status: 'generating',
  async run(ctx) {
    const ground = ctx.outputs.ground as InterviewGround;
    const prompt = ctx.prompts[INTERVIEW_TEMPLATE] ?? ctx.prompt;
    const { data, meta } = await ctx.gateway.extract({
      stage: 'interview_write',
      system: prompt.body.system.map((text) => ({ text })),
      input: {
        roleTitle: ground.roleTitle,
        company: ground.company,
        eligibleSkills: ground.eligibleSkills,
        excludedSkills: ground.excludedSkills,
        responsibilities: ground.responsibilities,
        roles: ground.roles,
        wanted: { technical: ground.eligibleSkills.length, behavioural: Math.max(4, INTERVIEW_SET_MIN - ground.eligibleSkills.length) },
      },
      schema: draftSchema,
      name: 'interview_set',
      description: 'Interview practice questions, each with a model answer and talking points.',
      context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: prompt.id },
    });
    return { output: data, meta };
  },
};

/** The deterministic gate (G14): what the model wrote is kept only where the grounding allows it. */
export function checkQuestions(ground: InterviewGround, draft: Draft): { questions: InterviewQuestion[]; dropped: number; padded: number } {
  const touchesExcluded = (q: Draft['questions'][number]) => ground.excludedSkills.some((skill) => [q.prompt, q.answer, ...q.talkingPoints, q.skill ?? ''].some((text) => mentions(text, skill)));
  const technical: InterviewQuestion[] = [];
  const behavioural: InterviewQuestion[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const q of draft.questions) {
    const key = lower(q.prompt);
    if (seen.has(key) || touchesExcluded(q)) {
      dropped++;
      continue;
    }
    seen.add(key);
    if (q.kind === 'technical') {
      // A technical question is about one eligible skill, in the resume's own spelling, or it goes.
      const skill = ground.eligibleSkills.find((s) => q.skill !== null && lower(s) === lower(q.skill));
      if (!skill || technical.length >= INTERVIEW_SET_MAX / 2) {
        dropped++;
        continue;
      }
      technical.push({ id: `q_tech_${technical.length}`, kind: 'technical', skill, prompt: q.prompt, answer: q.answer, talkingPoints: q.talkingPoints, mark: 'unmarked' });
    } else {
      behavioural.push({ id: `q_beh_${behavioural.length}`, kind: 'behavioural', prompt: q.prompt, answer: q.answer, talkingPoints: q.talkingPoints, mark: 'unmarked' });
    }
  }
  const questions = [...technical, ...behavioural].slice(0, INTERVIEW_SET_MAX);
  // Padded from the behavioural bank only: a generic technical question would claim a skill.
  let padded = 0;
  for (let index = 0; questions.length < INTERVIEW_SET_MIN && index < 50; index++) {
    const banked = fromBank(index, `q_bank_${index}`);
    if (seen.has(lower(banked.prompt))) continue;
    seen.add(lower(banked.prompt));
    questions.push(banked);
    padded++;
  }
  return { questions, dropped, padded };
}

export const interviewCheckStage: StageDef = {
  name: 'check',
  status: 'validating',
  async run(ctx) {
    const ground = ctx.outputs.ground as InterviewGround;
    return { output: checkQuestions(ground, ctx.outputs.write as Draft) };
  },
};

export const interviewPersistStage: StageDef = {
  name: 'persist',
  status: 'validating',
  async run(ctx) {
    const ground = ctx.outputs.ground as InterviewGround;
    const { questions } = ctx.outputs.check as { questions: InterviewQuestion[] };
    const source = (ctx.outputs.source as { resumeId: string } | null) ?? null;
    const jd = (ctx.outputs.jd as StageJd | null) ?? null;
    const setId = await ctx.db.withUser({ userId: ctx.userId, role: 'user' }, async (tx) => {
      // A redelivered run that already wrote its set reuses it (0023's unique index).
      const done = await tx.selectFrom('interview_question_sets').select('id').where('generation_id', '=', ctx.generationId).executeTakeFirst();
      if (done) return done.id;
      const jobId = jd ? ((await tx.selectFrom('job_descriptions').select('job_id').where('id', '=', jd.id).executeTakeFirst())?.job_id ?? null) : null;
      // Regenerating writes a new set and keeps the old one (§7.15); the newest earlier one is linked.
      let earlier = tx.selectFrom('interview_question_sets').select('id').orderBy('created_at', 'desc');
      earlier = source ? earlier.where('resume_id', '=', source.resumeId) : earlier.where('is_generic', '=', true).where('role_title', '=', ground.roleTitle);
      const previous = await earlier.executeTakeFirst();
      const title = (ground.mode === 'standalone' ? ground.roleTitle : ground.company ? `${ground.company} — ${ground.roleTitle}` : ground.roleTitle).slice(0, 200);
      const row = await tx
        .insertInto('interview_question_sets')
        .values({
          user_id: ctx.userId,
          generation_id: ctx.generationId,
          resume_id: source?.resumeId ?? null,
          job_description_id: jd?.id ?? null,
          job_id: jobId,
          regenerated_from_id: previous?.id ?? null,
          title,
          is_generic: ground.mode === 'standalone',
          company: ground.company,
          role_title: ground.mode === 'standalone' ? ground.roleTitle : null,
          questions: JSON.stringify(questions),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await tx
        .insertInto('activity')
        .values({
          user_id: ctx.userId,
          kind: 'interview',
          title: `Wrote **${questions.length} practice questions** for ${title}`,
          detail: ground.mode === 'standalone' ? 'Generic set — not tailored to a job description' : jd ? 'Drawn from your resume and the job description' : 'Drawn from your resume',
          deep_link: `/interview/${row.id}`,
          resume_id: source?.resumeId ?? null,
          job_ref: jobId,
        })
        .execute();
      return row.id;
    });
    return { output: { setId, questions: questions.length } };
  },
};
