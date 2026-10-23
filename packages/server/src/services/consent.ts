import { AI_PROVIDER_LIST, type AiConsent } from '@nextkin/shared/models/consent';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { AppError, errors } from '../http/errors';

/**
 * AI consent (ImBackendImplementationPlan P12-12; C-14). A user's content reaches an AI provider
 * only after they consented to the current provider list (`AI_PROVIDER_LIST.version`). Every AI
 * entry point checks it (a JD read from text or a file, a resume parse, every generation and section
 * run, an assistant message), and the runner checks it again before each run, so a consent
 * withdrawn mid-run stops the next one.
 */

export async function hasAiConsent(tx: Tx, userId: string): Promise<boolean> {
  const row = await tx
    .selectFrom('consents')
    .select('id')
    .where('user_id', '=', userId)
    .where('kind', '=', 'ai_processing')
    .where('document_version', '=', AI_PROVIDER_LIST.version)
    .where('withdrawn_at', 'is', null)
    .executeTakeFirst();
  return Boolean(row);
}

export const consentRequired = () => new AppError('CONSENT_REQUIRED', 'Before NextKin can use AI on your content, agree to the AI providers it uses.', { version: AI_PROVIDER_LIST.version });

/** Throws CONSENT_REQUIRED unless the user consented to the current provider list. */
export async function requireAiConsent(tx: Tx, userId: string): Promise<void> {
  if (!(await hasAiConsent(tx, userId))) throw consentRequired();
}

export async function getAiConsent(db: Database, identity: Identity): Promise<AiConsent> {
  const row = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('consents')
      .select(['document_version', 'granted_at'])
      .where('kind', '=', 'ai_processing')
      .where('withdrawn_at', 'is', null)
      .orderBy('granted_at', 'desc')
      .executeTakeFirst(),
  );
  const granted = row?.document_version === AI_PROVIDER_LIST.version;
  return { granted, ...(row ? { version: row.document_version, grantedAt: new Date(row.granted_at).toISOString() } : {}), current: { version: AI_PROVIDER_LIST.version, providers: AI_PROVIDER_LIST.providers } };
}

/** Records consent to the list the user saw; a stale version is refused, so they see the current one. */
export async function grantAiConsent(db: Database, identity: Identity, version: string): Promise<AiConsent> {
  if (version !== AI_PROVIDER_LIST.version) throw errors.conflict('The list of AI providers changed. Review it and agree again.');
  await db.withUser(identity, async (tx) => {
    if (await hasAiConsent(tx, identity.userId)) return;
    await tx.insertInto('consents').values({ user_id: identity.userId, kind: 'ai_processing', document_version: version }).execute();
  });
  return getAiConsent(db, identity);
}

/** Withdrawing stops new AI work; what was already made stays the user's. */
export async function withdrawAiConsent(db: Database, identity: Identity): Promise<AiConsent> {
  await db.withUser(identity, (tx) => tx.updateTable('consents').set({ withdrawn_at: sql`now()` }).where('kind', '=', 'ai_processing').where('withdrawn_at', 'is', null).execute());
  return getAiConsent(db, identity);
}
