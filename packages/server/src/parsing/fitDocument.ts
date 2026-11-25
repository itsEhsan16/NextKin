import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { z } from 'zod';

import { describeIssues, repairToSchema } from '../ai/schema';
import type { JsonSchema } from '../ai/types';

/**
 * A parsed resume made to fit the stored resume format (toreview §269). The cross-check keeps what
 * the file states, but its limits are not the format's (header links, section and bullet counts,
 * lengths), so a file that read fine could still be refused as "no resume to use". The same repair
 * the AI gateway uses trims it to the format; nothing is added. `issues` says what still fails.
 */
let canonicalJson: JsonSchema | undefined;
const canonicalSchemaJson = (): JsonSchema =>
  (canonicalJson ??= z.toJSONSchema(canonicalResumeSchema, { target: 'draft-7', unrepresentable: 'any', io: 'input' }) as JsonSchema);

export type FittedDocument = { ok: true; doc: CanonicalResumeJson; repaired: boolean } | { ok: false; issues: string };

export function fitDocument(document: unknown): FittedDocument {
  const direct = canonicalResumeSchema.safeParse(document);
  if (direct.success) return { ok: true, doc: direct.data, repaired: false };
  const fixed = canonicalResumeSchema.safeParse(repairToSchema(canonicalSchemaJson(), document));
  if (fixed.success) return { ok: true, doc: fixed.data, repaired: true };
  return { ok: false, issues: describeIssues(fixed.error) };
}

/**
 * A document with nothing a resume is made of: no role, no school and no project. A summary or a
 * skill list on its own is not one (owner, 2026-11-26): a read that kept only the summary was
 * stored as a finished resume.
 */
export const isEmptyResume = (doc: CanonicalResumeJson): boolean => doc.roles.length === 0 && doc.education.length === 0 && doc.projects.length === 0;
