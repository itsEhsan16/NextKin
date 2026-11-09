import { z } from 'zod';

/**
 * What the library's write routes accept (ImBackendImplementationPlan P10-02). The section values
 * are the apps' editor model (`models/resumeContent.ts`); the server writes them onto the canonical
 * document (`scoring/canonicalEdits.ts`).
 */

const text = (max: number) => z.string().max(max);
const lines = (count: number, max = 600) => z.array(text(max)).max(count);

const role = z.object({
  id: text(80),
  roleId: text(80).optional(),
  company: text(200),
  title: text(200),
  period: text(80),
  start: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/).optional(),
  end: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/).nullable().optional(),
  location: text(200).optional(),
  skills: lines(40, 120).optional(),
  companyLogoUrl: text(500).optional(),
  bullets: lines(12),
  needsReview: z.boolean().optional(),
});

const project = z.object({ id: text(80), name: text(200), description: text(1000), bullets: lines(8), needsReview: z.boolean().optional() });
const education = z.object({ id: text(80), institution: text(200), degree: text(200), period: text(80), needsReview: z.boolean().optional() });

export const sectionValueSchemas = {
  summary: text(2000),
  skills: lines(60, 120),
  experience: z.array(role).max(20),
  projects: z.array(project).max(10),
  certifications: lines(20, 200),
  education: z.array(education).max(10),
} as const;

export const resumeSectionKeySchema = z.enum(['summary', 'skills', 'experience', 'projects', 'certifications', 'education']);

/** "AI rewrite" on the ready screen (toreview §113): how the user wants one section changed. */
export const sectionRegenerateSchema = z.object({ instruction: z.string().trim().min(3).max(300).optional() }).strict();

export const sectionUpdateSchema = z.object({ value: z.unknown() });

export const letterPatchSchema = z
  .object({
    greeting: text(200).optional(),
    paragraphs: lines(8, 900).optional(),
    signoff: text(200).optional(),
    tone: z.enum(['professional', 'confident', 'conversational', 'concise']).optional(),
  })
  .strict();

const zeroDate = z.object({ year: z.number().int().min(1950).max(2100), month: z.number().int().min(1).max(12).optional() });
const zeroEnd = z.union([zeroDate, z.literal('present')]);

export const zeroResolutionSchema = z.union([
  z.object({ kind: z.literal('role'), roleId: text(80), remove: z.literal(true) }),
  z.object({ kind: z.literal('role'), roleId: text(80), remove: z.literal(false).optional(), title: text(200), company: text(200), start: zeroDate, end: zeroEnd }),
  z.object({ kind: z.literal('skill'), skill: text(120), remove: z.literal(true) }),
  z.object({ kind: z.literal('skill'), skill: text(120), remove: z.literal(false).optional(), name: text(120) }),
  z.object({ kind: z.literal('education'), entryId: text(80), remove: z.literal(true) }),
  z.object({ kind: z.literal('education'), entryId: text(80), remove: z.literal(false).optional(), degree: text(200), institution: text(200), start: zeroDate, end: zeroEnd }),
]);

export const documentCreateSchema = z.object({ title: z.string().trim().min(1).max(200), docType: z.enum(['resume', 'cover_letter']) }).strict();
export const renameSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();
export const atsFixSchema = z.object({ itemId: z.string().min(1).max(120) }).strict();
export const restoreSchema = z.object({ versionId: z.string().uuid() }).strict();

export const exportRequestSchema = z.object({ format: z.enum(['pdf', 'docx', 'txt']), template: z.string().min(1).max(80).optional() }).strict();

/*
 * Responses. Loose on the bodies, like the P9 result schema: the full shapes are the models',
 * checked by TypeScript on both sides; these pin what a client branches on.
 */
export const resumeCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    docType: z.enum(['resume', 'cover_letter']),
    status: z.enum(['queued', 'generating', 'validating', 'scoring', 'ready', 'failed']),
    currentVersionId: z.string(),
    versionCount: z.number().int().min(0),
    createdAt: z.string(),
    updatedAt: z.string(),
    tags: z.array(z.string()),
    accuracyConfirmed: z.boolean().optional(),
    needsReview: z.boolean().optional(),
  })
  .passthrough();
export const resumeListSchema = z.object({ data: z.array(resumeCardSchema) });
export const documentContentSchema = z.object({ kind: z.enum(['resume', 'cover_letter']), resumeId: z.string(), versionId: z.string() }).passthrough();
export const atsScorePanelSchema = z.object({ total: z.number().nullable(), band: z.enum(['strong', 'good', 'fair', 'weak']).nullable().optional(), sections: z.array(z.unknown()) }).passthrough();
export const resumeVersionSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  version: z.number().int().min(1),
  createdAt: z.string(),
  changeNote: z.string().optional(),
  actor: z.enum(['user', 'generation', 'restore', 'zero_review', 'upload']).optional(),
  locked: z.boolean().optional(),
});
export const versionChangeListSchema = z.object({
  data: z.array(
    z.object({
      kind: z.enum(['added', 'removed', 'reworded']),
      where: z.string(),
      text: z.string(),
      before: z.string().optional(),
      why: z.string(),
      restore: z
        .discriminatedUnion('at', [
          z.object({ at: z.literal('header'), index: z.number().int().min(0), text: z.string() }),
          z.object({ at: z.literal('summary'), index: z.number().int().min(0), text: z.string() }),
          z.object({ at: z.literal('bullet'), owner: z.string(), index: z.number().int().min(0), text: z.string() }),
        ])
        .optional(),
    }),
  ),
});
export const lineSourceSchema = z.object({
  text: z.string(),
  origin: z.enum(['generated', 'user', 'assumed']),
  facts: z.array(z.string()),
  before: z.string().optional(),
});
export const lineSourceListSchema = z.object({ data: z.array(lineSourceSchema) });
export const resumeVersionListSchema = z.object({ data: z.array(resumeVersionSchema) });
export const atsFixResultSchema = z.object({ content: documentContentSchema, score: atsScorePanelSchema });
export const zeroCheckResultSchema = z.object({ content: documentContentSchema, resume: resumeCardSchema, finished: z.boolean() });
export const sectionRunSchema = z.object({ id: z.string(), status: z.enum(['running', 'ready', 'failed']), message: z.string().optional() });
export const exportStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'ready', 'failed']),
  format: z.enum(['pdf', 'docx', 'txt']),
  fileName: z.string(),
  mimeType: z.string(),
  url: z.string().optional(),
  expiresAt: z.string().optional(),
  atsSafe: z.boolean().optional(),
  receipt: z
    .object({
      sections: z.object({ found: z.number(), total: z.number() }),
      bullets: z.object({ found: z.number(), total: z.number() }),
    })
    .optional(),
  message: z.string().optional(),
});
export const trashListSchema = z.object({ data: z.array(z.object({ id: z.string(), title: z.string(), trashedAt: z.string(), purgeAt: z.string() })) });
