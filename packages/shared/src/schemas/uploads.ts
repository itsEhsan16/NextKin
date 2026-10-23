import { z } from 'zod';
import { profileDraftSchema } from './profile';

/**
 * Uploads, resume parsing and the anonymous teaser over the wire (spec §11 `/uploads`,
 * `/resume-parse`; ImBackendImplementationPlan P7). A file goes presign → direct POST to storage →
 * confirm → scan; nothing reads it until the scan is clean.
 */

export const UPLOAD_PURPOSES = ['resume', 'jd', 'avatar'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** What each purpose accepts, by declared type. The bytes are checked again after upload. */
export const UPLOAD_TYPES: Record<UploadPurpose, readonly string[]> = {
  resume: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  jd: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
};

export const presignRequestSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().max(120),
    size: z.number().int().positive(),
  })
  .strict();

export const uploadSchema = z.object({
  id: z.string(),
  purpose: z.enum(UPLOAD_PURPOSES),
  fileName: z.string(),
  status: z.enum(['pending', 'scanning', 'clean', 'infected', 'failed', 'deleted']),
  /** Plain language, when the file was refused. */
  error: z.string().optional(),
});
export type Upload = z.infer<typeof uploadSchema>;

export const presignResponseSchema = z.object({
  upload: uploadSchema,
  /** POST the file here as multipart/form-data: every field first, the file last, named `file`. */
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  expiresAt: z.string(),
});
export type PresignResponse = z.infer<typeof presignResponseSchema>;

const hiddenSchema = z.object({ page: z.number().int(), text: z.string(), reason: z.string() });

export const parseFindingsSchema = z.object({
  kind: z.string().optional(),
  pages: z.number().int().optional(),
  /** Text that a reader would not see: reported, and excluded from everything (G9). */
  hidden: z.array(hiddenSchema).optional(),
  ocr: z.boolean().optional(),
  /** What the cross-check could not find in the document, and so left out of the draft. */
  rejected: z.array(z.object({ section: z.string(), item: z.string(), reason: z.string() })).optional(),
  /** Kept, but worth a second look (a title the document words differently). */
  flagged: z.array(z.object({ section: z.string(), item: z.string(), reason: z.string() })).optional(),
  /** How the file is laid out, measured from it (toreview §110.6): what an ATS meets in it. */
  layout: z
    .object({
      singleColumn: z.boolean(),
      noTablesOrImages: z.boolean(),
      standardHeadings: z.boolean(),
      standardFonts: z.boolean(),
      contactInBody: z.boolean(),
      found: z.array(z.string()),
    })
    .optional(),
});

export const resumeParseSchema = z.object({
  id: z.string(),
  uploadId: z.string(),
  status: z.enum(['waiting_scan', 'queued', 'reading', 'extracting', 'verifying', 'ready', 'failed']),
  draft: profileDraftSchema.optional(),
  findings: parseFindingsSchema,
  error: z.string().optional(),
  /** Machine-readable reason when failed: `unreadable` maps to UNREADABLE_FILE in the apps. */
  errorCode: z.string().optional(),
});
export type ResumeParse = z.infer<typeof resumeParseSchema>;

const choice = z.enum(['keep', 'merge', 'replace']);
/** Per section: keep the profile's, merge (the default: add what is new), or replace it. */
export const applyChoicesSchema = z
  .object({
    headline: z.enum(['keep', 'replace']).optional(),
    skills: choice.optional(),
    experiences: choice.optional(),
    education: choice.optional(),
    certifications: choice.optional(),
  })
  .strict();
export type ApplyChoices = z.infer<typeof applyChoicesSchema>;

export const teaserSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'scanning', 'analysing', 'ready', 'infected', 'failed']),
  /**
   * D-15: the parts and the findings, never a total without a JD. Until the rubric engine (P8) the
   * parts are the deterministic facts below.
   */
  findings: z
    .object({
      kind: z.string(),
      pages: z.number().int(),
      readable: z.boolean(),
      ocr: z.boolean(),
      characters: z.number().int(),
      sections: z.record(z.string(), z.boolean()),
      hidden: z.array(hiddenSchema),
    })
    .optional(),
  error: z.string().optional(),
});
export type Teaser = z.infer<typeof teaserSchema>;
