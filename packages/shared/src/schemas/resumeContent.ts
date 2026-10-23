import { z } from 'zod';

/**
 * The canonical resume JSON (ImBackendImplementationPlan P9-02, old M2-06): what generation writes,
 * what `resume_versions.content` stores and what the claim ledger checks (G13). Dates are
 * structured (`YYYY` or `YYYY-MM`, `null` for present); the printed period is derived from them.
 * Every claim has an id and cites the profile facts it rests on, unless the user typed it (`user`)
 * or Zero Resume assumed it (`assumed`).
 *
 * The app's editor model (`models/resumeContent.ts`) is derived from this by
 * `scoring/canonical.ts`, never the other way round.
 */

export const CANONICAL_SCHEMA_VERSION = 1;

const isoPartial = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'YYYY or YYYY-MM');
const factId = z.string().min(1).max(80);

export const claimSchema = z
  .object({
    id: z.string().min(1).max(64),
    text: z.string().trim().min(1).max(600),
    evidence: z.array(factId).max(20),
    origin: z.enum(['generated', 'user', 'assumed']),
  })
  .refine((claim) => claim.origin !== 'generated' || claim.evidence.length > 0, {
    message: 'A generated claim cites the facts it rests on.',
    path: ['evidence'],
  });

export const canonicalRoleSchema = z.object({
  roleId: factId,
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  start: isoPartial.nullable(),
  end: isoPartial.nullable(),
  location: z.string().max(200).optional(),
  /** The role's skill tags from the profile: what its technology claims rest on. */
  skills: z.array(z.string().min(1).max(120)).max(40),
  bullets: z.array(claimSchema).max(12),
  /**
   * Client projects inside a role, as the user's file groups them (toreview §111): each names the
   * bullets it holds by id. The bullets stay one list on the role, so the claim ledger, the facts
   * and the editor read them as before; only the page groups them.
   */
  entries: z
    .array(z.object({ title: z.string().trim().min(1).max(200), tech: z.string().max(300).optional(), bulletIds: z.array(z.string().min(1).max(64)).max(12) }))
    .max(6)
    .optional(),
  /** Zero Resume assumed this role (V2 §7.9): the review flow holds it until the user answers. */
  assumed: z.literal(true).optional(),
});

/** One piece of the contact row, as printed: a place, a phone, an email, a link's label. */
const headerItem = z.object({ text: z.string().trim().min(1).max(200), url: z.string().max(500).optional() });

/**
 * The resume's own header (toreview §111): the name and contact row its file printed, in order.
 * Never facts and never a model input (G5): it is typeset as the user wrote it, and only the
 * renderers read it.
 */
export const resumeHeaderSchema = z.object({ name: z.string().trim().min(1).max(120), items: z.array(headerItem).max(12) });

/** A section the six standard ones do not cover (Extracurricular, Awards), kept as written. */
export const extraSectionSchema = z.object({
  id: z.string().min(1).max(40),
  heading: z.string().trim().min(1).max(80),
  entries: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        subtitle: z.string().max(200).optional(),
        right: z.string().max(80).optional(),
        subRight: z.string().max(120).optional(),
        bullets: z.array(claimSchema).max(8),
      }),
    )
    .max(8),
  /** Lines under the heading that are not entries ("HackerRank skill assessments: Java, Python"). */
  lines: z.array(claimSchema).max(12),
});

/** Where each section goes and what the file called it. Keys: the six standard ones, or `x:<id>`. */
export const resumeLayoutSchema = z.object({
  order: z.array(z.string().min(1).max(44)).max(16),
  headings: z.record(z.string().max(44), z.string().trim().min(1).max(80)),
});

/** What a Zero Resume draft asked the user to check, written with it (ZERO 03's count). */
export const zeroReviewSchema = z.object({
  total: z.number().int().min(0).max(200),
  roles: z.number().int().min(0).max(20),
  education: z.number().int().min(0).max(10),
  /** Every skill claim the draft made; the ones still `assumed` are pending. */
  skills: z.array(z.string().min(1).max(120)).max(60),
  removedSkills: z.array(z.string().min(1).max(120)).max(60),
});

export const canonicalResumeSchema = z.object({
  schemaVersion: z.literal(CANONICAL_SCHEMA_VERSION),
  headline: z.string().trim().max(200).optional(),
  summary: claimSchema.optional(),
  skills: z
    .array(z.object({ name: z.string().trim().min(1).max(120), id: z.string().min(1).max(64), evidence: z.array(factId).max(20), origin: z.enum(['generated', 'user', 'assumed']) }))
    .max(60),
  /** The file's skill lines ("Front End: React, Next.js"), naming skills of `skills` by name. */
  skillGroups: z.array(z.object({ label: z.string().trim().min(1).max(80), names: z.array(z.string().min(1).max(120)).max(40) })).max(12).optional(),
  roles: z.array(canonicalRoleSchema).max(20),
  education: z
    .array(
      z.object({
        factId,
        institution: z.string().trim().min(1).max(200),
        degree: z.string().trim().min(1).max(200),
        field: z.string().max(200).optional(),
        start: isoPartial.nullable().optional(),
        end: isoPartial.nullable().optional(),
        /** As printed: "GPA: 7.4 / 10". */
        gpa: z.string().max(60).optional(),
        location: z.string().max(120).optional(),
        assumed: z.literal(true).optional(),
      }),
    )
    .max(10),
  certifications: z.array(z.object({ factId, name: z.string().trim().min(1).max(200), issuer: z.string().max(200).optional() })).max(20),
  projects: z
    .array(
      z.object({
        factId,
        name: z.string().trim().min(1).max(200),
        description: z.string().max(1000).optional(),
        /** The stack line as printed: "React, TypeScript, SQL". */
        tech: z.string().max(300).optional(),
        start: isoPartial.nullable().optional(),
        end: isoPartial.nullable().optional(),
        bullets: z.array(claimSchema).max(8),
      }),
    )
    .max(10),
  review: zeroReviewSchema.optional(),
  header: resumeHeaderSchema.optional(),
  sections: z.array(extraSectionSchema).max(6).optional(),
  layout: resumeLayoutSchema.optional(),
  /** The page design the resume is typeset in (`models/resumeDocument.ts`); absent is Classic. */
  template: z.enum(['jake', 'modern', 'elegant']).optional(),
});

/** A cover letter version (V2 §7.10): each paragraph a claim citing what it rests on. */
export const canonicalLetterSchema = z.object({
  kind: z.literal('cover_letter'),
  schemaVersion: z.literal(CANONICAL_SCHEMA_VERSION),
  tone: z.enum(['professional', 'confident', 'conversational', 'concise']),
  greeting: z.string().max(200),
  paragraphs: z.array(claimSchema).max(8),
  signoff: z.string().max(200),
  /** Written from a Zero Resume draft's assumed facts: the download gate holds (V2 §7.9). */
  assumed: z.literal(true).optional(),
});

export type CanonicalLetterJson = z.infer<typeof canonicalLetterSchema>;
export type CanonicalClaim = z.infer<typeof claimSchema>;
export type CanonicalRoleJson = z.infer<typeof canonicalRoleSchema>;
export type CanonicalResumeJson = z.infer<typeof canonicalResumeSchema>;
