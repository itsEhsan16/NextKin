import { z } from 'zod';

/**
 * What `PUT /resumes/{id}/document` accepts (toreview §124): the editor's whole document
 * (`models/resumeDocument.ts`). Limits match the canonical schema's, so a body that passes here
 * fits a version; blank entries are allowed in flight (the editor saves as the user types) and
 * the download check names them instead.
 */

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const iso = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'YYYY or YYYY-MM').nullable();
const line = z.object({ id, text: text(600) });
const lines = (max: number) => z.array(line).max(max);

const role = z.object({
  id,
  company: text(200),
  title: text(200),
  location: text(200),
  start: iso,
  end: iso,
  bullets: lines(12),
  groups: z.array(z.object({ id, title: text(200), tech: text(300), bullets: lines(12) })).max(6),
  assumed: z.boolean().optional(),
});

const project = z.object({ id, name: text(200), description: text(1000), tech: text(300), start: iso, end: iso, bullets: lines(8) });

const education = z.object({
  id,
  institution: text(200),
  degree: text(200),
  field: text(200),
  start: iso,
  end: iso,
  gpa: text(60),
  location: text(120),
  assumed: z.boolean().optional(),
});

const custom = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  heading: text(80),
  entries: z.array(z.object({ id, title: text(200), subtitle: text(200), right: text(80), subRight: text(120), bullets: lines(8) })).max(8),
  lines: lines(12),
});

const sectionKey = z.string().regex(/^(summary|skills|experience|projects|education|certifications|x:[A-Za-z0-9_-]{1,40})$/);

export const resumeDocumentWriteSchema = z
  .object({
    header: z.object({
      name: text(120),
      headline: text(200),
      items: z.array(z.object({ id, text: text(200), url: text(500).optional() })).max(12),
    }),
    summary: text(2000),
    skills: z.object({
      groups: z.array(z.object({ id, label: text(80), skills: z.array(text(120)).max(40) })).max(12),
      loose: z.array(text(120)).max(60),
    }),
    experience: z.array(role).max(20),
    projects: z.array(project).max(10),
    education: z.array(education).max(10),
    certifications: z.array(z.object({ id, name: text(200), issuer: text(200) })).max(20),
    custom: z.array(custom).max(6),
    order: z.array(sectionKey).max(16),
    headings: z.partialRecord(z.enum(['summary', 'skills', 'experience', 'projects', 'education', 'certifications']), text(80)),
    template: z.enum(['jake', 'modern', 'elegant']),
  })
  .strict();

export const resumeDocumentSchema = resumeDocumentWriteSchema.extend({
  resumeId: z.string().min(1),
  versionId: z.string().min(1),
  revision: z.string().min(1),
  pendingReview: z.boolean().optional(),
});

/** The save: the document, and the revision it was edited from. */
export const resumeDocumentSaveSchema = z.object({ document: resumeDocumentWriteSchema, baseRevision: z.string().min(1).max(128) }).strict();
