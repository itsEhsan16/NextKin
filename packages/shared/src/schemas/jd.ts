import { z } from 'zod';

import { jobSchema } from './job';

/**
 * Job descriptions over the wire (spec §11 `/api/v1/jd`; ImBackendImplementationPlan P9-01).
 * A paste or a scanned upload goes in; the extraction runs as a job and the client polls the draft
 * until it is `ready`. What the user corrects on the review screen is what generation reads (§7.5).
 */

const level = z.enum(['entry', 'mid', 'senior', 'lead']);
const employment = z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']);
const list = z.array(z.string().trim().min(1).max(120)).max(40);

/** The fields the user may correct; the source text, origin and identity are fixed. */
export const jdPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().max(200),
    location: z.string().trim().max(200),
    experienceLevel: level,
    employmentType: employment,
    domain: z.string().trim().max(120),
    requiredSkills: list,
    preferredSkills: list,
    tools: list,
    responsibilities: z.array(z.string().trim().min(1).max(400)).max(40),
    savedToJobs: z.boolean(),
    /** The listing a draft came from, when the client made it from one (P11 serves listings). */
    jobId: z.string().max(200),
  })
  .partial()
  .strict();

export const jdCreateSchema = z.discriminatedUnion('source', [
  // Server cap 20,000 characters (P0's default on silence; web already caps at 10,000).
  z.object({ source: z.literal('paste'), text: z.string().trim().min(40).max(20000), details: jdPatchSchema.optional() }).strict(),
  z.object({ source: z.literal('file'), uploadId: z.uuid(), details: jdPatchSchema.optional() }).strict(),
  // P11: a listing on NextKin, by the id it carries. Read from the listing itself, no model call.
  // A link: the reader service reads the page, and what it says goes through the same extraction.
  z.object({ source: z.literal('link'), url: z.string().trim().min(4).max(2000), details: jdPatchSchema.optional() }).strict(),
  z.object({ source: z.literal('job'), jobId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i), details: jdPatchSchema.optional() }).strict(),
]);

const jdSectionSchema = z.object({
  kind: z.enum(['overview', 'about_company', 'responsibilities', 'requirements', 'preferred', 'benefits', 'compensation', 'location', 'how_to_apply', 'other']),
  heading: z.string().max(120).optional(),
  paragraphs: z.array(z.string().max(2000)).max(40),
  items: z.array(z.string().max(600)).max(60),
});
export const jdReadingSchema = z.object({
  sections: z.array(jdSectionSchema).max(30),
  salary: z.string().max(120).optional(),
  workArrangement: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  confidence: z.enum(['strong', 'weak']),
  by: z.enum(['rules', 'model']),
});

export const jdDraftSchema = z.object({
  id: z.string(),
  source: z.enum(['paste', 'file', 'job', 'link']),
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  experienceLevel: level.optional(),
  employmentType: employment.optional(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  tools: z.array(z.string()),
  softSkills: z.array(z.string()).optional(),
  domain: z.string().optional(),
  rawText: z.string(),
  sourceUrl: z.string().optional(),
  savedToJobs: z.boolean().optional(),
  /** The listing a draft was read from (P11). */
  jobId: z.string().optional(),
  requirements: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        importance: z.enum(['required', 'preferred']),
        kind: z.enum(['skill', 'eligibility']),
        minYears: z.number().optional(),
        span: z.object({ start: z.number(), end: z.number() }).optional(),
      }),
    )
    .optional(),
  status: z.enum(['extracting', 'ready', 'failed']).optional(),
  error: z.string().optional(),
  extraction: z.object({ kept: z.number(), dropped: z.number() }).optional(),
  language: z.enum(['en', 'de', 'other']).optional(),
  /** The JD in its sections, when a model grouped them (toreview §129); else the page reads them. */
  reading: jdReadingSchema.optional(),
  createdAt: z.string(),
});

/**
 * How the user's profile matches a job description (the JD page's match card): the same engine and
 * the same fields as a listing's match (P11-03). Empty when there is nothing to score yet: no
 * profile, or the JD is not ready.
 */
export const jdMatchSchema = jobSchema.pick({
  matchScore: true,
  matchBand: true,
  matchBasis: true,
  matchCriteria: true,
  matchReason: true,
});

export type JdMatchBody = z.infer<typeof jdMatchSchema>;

/**
 * A resume measured against a JD (W-TAILOR 01, toreview §110): the engine's score against this
 * JD, its keywords on and off the resume, and what to improve. Engines only, no model call.
 */
/** "Job match" (toreview §112): the JD's keywords the resume shows, with the missing ones. */
export const jobMatchSchema = z.object({ matched: z.number().int().min(0), total: z.number().int().min(1), percent: z.number().min(0).max(100), missing: z.array(z.string()), basis: z.string() });

export const tailorComparisonSchema = z.object({
  resumeId: z.string(),
  jobId: z.string().optional(),
  jdId: z.string(),
  score: z.number().min(0).max(100),
  scored: z.boolean().optional(),
  keywords: z.array(z.object({ label: z.string(), onResume: z.boolean(), shown: z.enum(['experience', 'listed', 'fewer_years']).optional(), source: z.enum(['required', 'description']), quote: z.string().optional(), top: z.boolean().optional(), kind: z.enum(['skill', 'soft']).optional() })),
  improvements: z.array(
    z.object({ key: z.enum(['headline', 'summary', 'length', 'layout', 'skills', 'years']), label: z.string(), detail: z.string(), ok: z.boolean() }),
  ),
  pageCount: z.number().int().min(1).optional(),
  pagesEstimated: z.boolean().optional(),
  jobMatch: jobMatchSchema.optional(),
  places: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  plan: z
    .object({
      score: z.number(),
      parts: z.array(z.object({ key: z.enum(['keywords', 'timeline', 'sections', 'formatting', 'achievements']), label: z.string(), max: z.number(), got: z.number(), lost: z.number(), basis: z.string() })),
      steps: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(['keyword', 'evidence', 'number', 'timeline', 'wording', 'headline', 'summary', 'years', 'section', 'format']),
          title: z.string(),
          need: z.string().optional(),
          have: z.string(),
          worth: z.number().nullable(),
          basis: z.string(),
          who: z.enum(['ai', 'you', 'nobody']),
          keyword: z.string().optional(),
          importance: z.enum(['required', 'preferred']).optional(),
          totalAfter: z.number().optional(),
          bullet: z.object({ roleId: z.string(), index: z.number().int().min(0), text: z.string() }).optional(),
          where: z.string().max(200).optional(),
        }),
      ),
      // The path to the owner's 8.5 (toreview §129).
      target: z.object({ goal: z.number(), ai: z.number(), ceiling: z.number(), reaches: z.boolean(), steps: z.number().int().min(0).nullable() }).optional(),
    })
    .optional(),
});
export const comparisonQuerySchema = z.object({ resumeId: z.string().max(100) });

/** "Add the result", drafted (toreview §129): which bullet of which resume. */
export const figureDraftRequestSchema = z.object({ resumeId: z.string().max(100), roleId: z.string().max(200), line: z.number().int().min(0).max(60) }).strict();
export const figureDraftSchema = z.object({ before: z.string(), after: z.string(), hint: z.string(), by: z.enum(['model', 'rules']) });
export type JdCreate = z.infer<typeof jdCreateSchema>;
export type JdPatchBody = z.infer<typeof jdPatchSchema>;
