import { z } from 'zod';

/**
 * A resume's typeset pages over the wire (toreview §111): `GET /resumes/{id}/preview`. The pages
 * are images of the PDF the download holds, compiled by LaTeX on the worker.
 *
 * - `ready`: this version's pages and its PDF.
 * - `pending`: this version is still being typeset; `pages` may hold the previous version's pages,
 *   flagged `stale`, so the preview stays up while it updates.
 * - `failed`: it could not be typeset; the client shows its structured preview.
 * - `structured`: there are no pages to show for this document (an open Zero Resume review, or a
 *   cover letter); the client shows its structured preview.
 */

export const previewPageSchema = z.object({ url: z.string(), width: z.number().int().min(0), height: z.number().int().min(0) });

export const resumePreviewSchema = z.object({
  status: z.enum(['ready', 'pending', 'failed', 'structured']),
  versionId: z.string(),
  pageCount: z.number().int().min(1).optional(),
  paper: z.enum(['letter', 'a4']).optional(),
  pages: z.array(previewPageSchema).default([]),
  pdfUrl: z.string().optional(),
  /** The pages shown are an earlier version's while this one is typeset. */
  stale: z.boolean().optional(),
  /** When the page and PDF links stop working. */
  expiresAt: z.string().optional(),
});

export type ResumePreview = z.infer<typeof resumePreviewSchema>;
export type PreviewPage = z.infer<typeof previewPageSchema>;
