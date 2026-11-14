import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import type { ElsewhereSource, OwnRole } from '@nextkin/shared/tailor/elsewhere';

import type { Tx } from '../db/database';
import { loadFacts } from '../pipeline/facts';
import { profileDocument } from '../pipeline/stages/common';

/**
 * The candidate's other records, for "you already have this" (owner, 2026-11-15; toreview §206.3):
 * their profile, their other resumes and their certificates. Read under the user's own row-level
 * security, like the resume being tailored; nothing here calls a model.
 *
 * Only resumes that were not themselves tailored to a job are read. A tailored resume carries
 * skill tags the AI placed on a role for that one job (`by: 'ai'`, §162): real enough for the
 * resume they sit on, but not a record of the candidate's that should vouch for a new one.
 */

/** Enough to cover a candidate's working set; the newest first. */
const OTHER_RESUMES = 5;

export interface Elsewhere {
  sources: ElsewhereSource[];
  certificates: string[];
  roles: OwnRole[];
}

export async function readElsewhere(tx: Tx, userId: string, resumeId: string, doc: CanonicalResumeJson): Promise<Elsewhere> {
  const [snapshot, others] = await Promise.all([
    loadFacts(tx, userId),
    tx
      .selectFrom('resumes as r')
      .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.id', 'r.title', 'v.content'])
      .where('r.user_id', '=', userId)
      .where('r.id', '!=', resumeId)
      .where('r.doc_type', '=', 'resume')
      .where('r.job_description_id', 'is', null)
      .where('r.archived_at', 'is', null)
      .where('r.trashed_at', 'is', null)
      .orderBy('r.updated_at', 'desc')
      .limit(OTHER_RESUMES)
      .execute(),
  ]);
  const { facts, contact } = snapshot;
  const sources: ElsewhereSource[] = [];
  if (facts.roles.length > 0 || facts.skills.length > 0) sources.push({ from: 'profile', label: 'your profile', document: profileDocument(facts, contact) });
  for (const other of others) {
    const parsed = canonicalResumeSchema.safeParse(other.content);
    if (parsed.success) sources.push({ from: 'resume', label: other.title, document: profileDocument(factsOfDocument(parsed.data), contact) });
  }
  return {
    sources,
    certificates: facts.certifications.map((c) => c.name),
    roles: doc.roles.map((role) => ({ id: role.roleId, title: role.title, company: role.company })),
  };
}
