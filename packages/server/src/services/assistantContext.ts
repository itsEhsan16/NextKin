import { buildAssistantContext } from '@nextkin/shared/assistant/context';
import { documentBody } from '@nextkin/shared/assistant/documentBody';
import type { AtsReport, AtsScore } from '@nextkin/shared/models/resume';
import { redactPersonal } from '@nextkin/shared/privacy/contact';

import type { ServerAssistantContext } from '../assistant/brain';
import type { Tx } from '../db/database';
import { readContent, resumeCard } from './resumeRead';
import { UUID } from './assistantThreads';

/**
 * What the assistant may know about the open document (V2 §7.16, §8.5).
 *
 * The card, the score and its quick wins and gaps, the requirement ledger, and (owner, 2026-10-18)
 * the document's own text: every section, role and bullet. Never the contact block, and never the
 * user's name (G5): `documentBody` does not read `contact` or `links`, and every line it copies
 * goes through `redactPersonal` with the user's first and last name, as the title does. The model
 * gateway's `assertNoContact` still checks the result before any call.
 */
export async function contextFor(tx: Tx, userId: string, resumeId: string): Promise<ServerAssistantContext | null> {
  if (!UUID.test(resumeId)) return null;
  const owned = await tx.selectFrom('resumes').select('current_version_id').where('id', '=', resumeId).where('trashed_at', 'is', null).executeTakeFirst();
  if (!owned) return null;
  const resume = await resumeCard(tx, resumeId);
  // A version the server cannot read leaves the card and the score; the message still gets answered.
  const content = owned.current_version_id ? await readContent(tx, userId, resumeId).catch(() => undefined) : undefined;
  const report = owned.current_version_id
    ? await tx.selectFrom('ats_reports').select('basis').where('resume_version_id', '=', owned.current_version_id).orderBy('created_at', 'desc').executeTakeFirst()
    : undefined;
  const basis = (report?.basis ?? null) as { panel?: AtsScore | null; report?: AtsReport } | null;
  const person = await tx.selectFrom('users').select(['first_name', 'last_name']).where('id', '=', userId).executeTakeFirst();
  const redact = (text: string) => redactPersonal(text, [person?.first_name, person?.last_name]);

  const base = buildAssistantContext({ resume: { ...resume, title: redact(resume.title) }, ...(content ? { content } : {}), ...(basis?.panel ? { score: basis.panel } : {}) });
  return {
    ...base,
    ...(content?.kind === 'resume' ? { body: documentBody(content, redact) } : {}),
    requirements: (basis?.report?.requirements ?? []).slice(0, 30).map((r) => ({ text: redact(r.text), status: r.status, importance: r.importance })),
  };
}
