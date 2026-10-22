import { z } from 'zod';

/**
 * The shareable ATS report (ImBackendImplementationPlan P11-10; V2 §4.1): what a public link shows.
 * The score, the rubric's parts with the basis each rests on, the requirement checklist, a few
 * suggestions and the method's versions. Never a contact detail, never evidence text (a bullet, the
 * resume's own wording), never an employer of the user's; the target employer only when the user
 * chose to show it. No total without a JD (D-15).
 */

export const sharedReportSchema = z.object({
  targetTitle: z.string().nullable(),
  targetCompany: z.string().nullable(),
  total: z.number().nullable(),
  band: z.enum(['strong', 'good', 'fair', 'weak']).nullable(),
  jdMatch: z
    .object({ percent: z.number(), requiredMet: z.number(), requiredPartial: z.number(), requiredTotal: z.number(), preferredMet: z.number(), preferredTotal: z.number() })
    .nullable(),
  components: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number(), score: z.number().nullable(), points: z.number().nullable(), basis: z.string() })),
  requirements: z.array(z.object({ text: z.string(), importance: z.string(), status: z.string() })),
  suggestions: z.array(z.string()),
  method: z.object({ engine: z.string(), rubric: z.string(), taxonomy: z.string(), kb: z.string(), asOf: z.string() }),
  sharedAt: z.string(),
});
export type SharedReport = z.infer<typeof sharedReportSchema>;

export const shareLinkSchema = z.object({ id: z.string(), url: z.string() });
export const shareCreateSchema = z.object({ showEmployer: z.boolean().default(false) }).strict();

export const sharedReportLinkSchema = z.object({ id: z.string(), resumeId: z.string().nullable(), title: z.string(), createdAt: z.string(), revokedAt: z.string().nullable() });
export const sharedReportLinkListSchema = z.object({ data: z.array(sharedReportLinkSchema) });
