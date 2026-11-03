import { z } from 'zod';
import type { Generation, GenerationInput } from '../models/generation';

/**
 * A generation over the wire (spec §11 `/api/v1/generations`; ImBackendImplementationPlan P6-13,
 * P6-15). The SSE stream carries this whole snapshot in every event's `data`, so a client that
 * missed events needs only the latest one. The run-specific results (tailor, Zero Resume seed, ATS
 * check) join it as their pipelines land (P9).
 */

const kind = z.enum(['resume', 'cover_letter', 'zero_resume', 'ats_check', 'interview']);
const tone = z.enum(['professional', 'confident', 'conversational', 'concise']);
const choices = z.object({ added: z.array(z.string().trim().min(1).max(120)).max(30), skipped: z.array(z.string().trim().min(1).max(120)).max(30) }).strict();
const band = z.enum(['strong', 'good', 'fair', 'weak']);
const atsCheck = z.object({
  score: z.number(),
  band,
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  missing: z.array(z.string()),
  report: z
    .object({
      jdMatch: z
        .object({
          percent: z.number(),
          requiredMet: z.number(),
          requiredPartial: z.number(),
          requiredTotal: z.number(),
          preferredMet: z.number(),
          preferredTotal: z.number(),
          completeness: z.enum(['full', 'snippet']),
        })
        .nullable(),
      components: z.array(
        z.object({
          key: z.enum(['keywords', 'timeline', 'sections', 'formatting', 'achievements']),
          label: z.string(),
          weight: z.number(),
          score: z.number().nullable(),
          points: z.number().nullable(),
          basis: z.string(),
        }),
      ),
      notMeasured: z.array(z.string()),
    })
    .optional(),
  fixes: z.array(z.object({ key: z.enum(['columns', 'summary', 'results', 'length']), title: z.string(), detail: z.string() })),
});

export const generationSchema = z.object({
  id: z.string(),
  kind,
  status: z.enum(['queued', 'generating', 'validating', 'scoring', 'ready', 'failed']),
  /** 0–1: the share of the pipeline's stages that are done. */
  progress: z.number().min(0).max(1),
  startedAt: z.string(),
  updatedAt: z.string(),
  /** Plain language, safe to show. */
  error: z.string().optional(),
  cancelled: z.boolean().optional(),
  resumeId: z.string().optional(),
  jdId: z.string().optional(),
  jobId: z.string().optional(),
  title: z.string().optional(),
  tone: tone.optional(),
  sourceResumeId: z.string().optional(),
  origin: z.literal('build').optional(),
  /** BUILD 04c's answers, for the build's ready screen (P9). */
  build: choices.optional(),
  /** A finished ATS check's result (P9). */
  atsCheck: atsCheck.optional(),
  /** A tailored run (toreview §110.3): what was asked, the baseline, and once done, the result. */
  tailor: z
    .object({
      sourceResumeId: z.string(),
      baselineScore: z.number(),
      added: z.array(z.string()),
      skipped: z.array(z.string()),
      fixes: z.array(z.enum(['headline', 'summary', 'skills', 'experience', 'projects', 'length'])).optional(),
      experience: z.enum(['quick', 'full']).optional(),
      sourcePages: z.number().optional(),
      score: z.number().optional(),
      changes: z.array(z.object({ label: z.string(), left: z.boolean() })).optional(),
      stripped: z.number().optional(),
      pages: z.number().optional(),
      pageBasis: z.string().optional(),
      confirmed: z.array(z.object({ keyword: z.string(), where: z.string(), note: z.string().optional(), by: z.enum(['ai', 'you']).optional() })).optional(),
      figures: z.array(z.object({ where: z.string().trim().min(1).max(100), line: z.number().int().min(0).max(60), text: z.string().trim().min(1).max(300) })).optional(),
      projected: z.number().optional(),
      jobMatch: z.object({ matched: z.number(), total: z.number(), percent: z.number(), missing: z.array(z.string()), basis: z.string() }).optional(),
      baselineJobMatch: z.object({ matched: z.number(), total: z.number(), percent: z.number(), missing: z.array(z.string()), basis: z.string() }).optional(),
    })
    .optional(),
}) satisfies z.ZodType<Generation>;

/**
 * What a tailored run asks of the server (toreview §110.3), beside `baseResumeId`: the parts to
 * rewrite, how much of the work history, and the missing keywords the user ticked as true. The
 * server works out the baseline and what was skipped itself.
 */
export const tailoringSchema = z
  .object({
    fixes: z.array(z.enum(['headline', 'summary', 'skills', 'experience', 'projects', 'length'])).max(6),
    experience: z.enum(['quick', 'full']).optional(),
    // A long JD names 40+ terms, and reaching 8.5 can mean ticking most of them (toreview §129).
    keywords: z.array(z.string().trim().min(1).max(120)).max(80),
    /** Ticked keywords the user says they used, and where (toreview §112): a role or `project:<id>`, up to three per keyword (§163). */
    confirmed: z
      .array(z.object({ keyword: z.string().trim().min(1).max(120), where: z.string().trim().min(1).max(100), note: z.string().trim().max(200).optional(), by: z.enum(['ai', 'you']).optional() }).strict())
      .max(240)
      .optional(),
    /** Bullets the user rewrote with their real result (toreview §129). */
    figures: z.array(z.object({ where: z.string().trim().min(1).max(100), line: z.number().int().min(0).max(60), text: z.string().trim().min(1).max(300) }).strict()).max(40).optional(),
  })
  .strict();
export type Tailoring = z.infer<typeof tailoringSchema>;

export const generationInputSchema = z
  .object({
    kind,
    jdId: z.string().max(100).optional(),
    jobId: z.string().max(200).optional(),
    baseResumeId: z.string().max(100).optional(),
    sourceResumeId: z.string().max(100).optional(),
    title: z.string().trim().max(200).optional(),
    tone: tone.optional(),
    origin: z.literal('build').optional(),
    /** BUILD 04c: skills the user says are true; they join the profile before the run reads it. */
    build: choices.optional(),
    /** A tailored run of `baseResumeId` (toreview §110.3). */
    tailoring: z.lazy(() => tailoringSchema).optional(),
    /** Zero Resume Mode's seed (§7.9). The name is stored, never sent to a model (G5). */
    zero: z
      .object({
        fullName: z.string().trim().max(120),
        yearsExperience: z.number().min(0).max(60),
        yearsBand: z.enum(['none', '1-2', '3-5', '6-10', '10+']).optional(),
        targetTitle: z.string().trim().max(200).optional(),
        location: z.string().trim().max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict() satisfies z.ZodType<GenerationInput>;
/** What the server is asked to run: the app's input in its wire form (`tailoring`, not `tailor`). */
export type GenerationRequest = z.infer<typeof generationInputSchema>;

/** The SSE event names (§11). */
export const GENERATION_EVENTS = ['stage_started', 'stage_completed', 'failed', 'completed'] as const;
export type GenerationEventName = (typeof GENERATION_EVENTS)[number];

/**
 * A finished run's document (P9-08): the resume card, its body and its score panel, as the apps
 * model them. Loose on the body and the panel: their shapes are the models', checked by TypeScript
 * on both sides.
 */
export const generationResultSchema = z.object({
  resume: z.object({ id: z.string(), title: z.string(), docType: z.enum(['resume', 'cover_letter']), status: z.enum(['queued', 'generating', 'validating', 'scoring', 'ready', 'failed']), currentVersionId: z.string() }).passthrough(),
  content: z.object({ kind: z.enum(['resume', 'cover_letter']) }).passthrough(),
  score: z.object({ total: z.number(), band: z.enum(['strong', 'good', 'fair', 'weak']), summary: z.string(), sections: z.array(z.unknown()) }).passthrough().optional(),
});
