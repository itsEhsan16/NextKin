import type { FaqItem, LegalDoc, LegalDocKey, SupportTicket, TicketInput } from '@nextkin/shared/models/support';

import type { Database, Identity } from '../db/database';
import type { EmailPort } from '../email/email';
import { errors } from '../http/errors';
import type { Logger } from '../observability/logger';

/**
 * Support (ImBackendImplementationPlan P12-13; V2 §8.5). The FAQ and the legal documents are
 * versioned content: users read the newest published version of each, and admins publish a new
 * version rather than editing one in place (P12-05). A ticket is kept and emailed to the support
 * inbox with its request id, so a reply can find the request in the logs.
 */

export interface SupportDeps {
  db: Database;
  email: EmailPort;
  inbox: string;
  log: Logger;
}

async function published<T>(db: Database, key: 'faq' | 'terms' | 'privacy'): Promise<T | null> {
  const row = await db.withAnonymous((tx) => tx.selectFrom('content_documents').select('body').where('key', '=', key).where('published_at', 'is not', null).orderBy('version', 'desc').executeTakeFirst());
  return (row?.body as T | undefined) ?? null;
}

export async function listFaq(db: Database): Promise<FaqItem[]> {
  return (await published<FaqItem[]>(db, 'faq')) ?? [];
}

export async function getLegal(db: Database, key: LegalDocKey): Promise<LegalDoc> {
  const doc = await published<LegalDoc>(db, key);
  if (!doc) throw errors.notFound('document');
  return doc;
}

export async function submitTicket(deps: SupportDeps, identity: Identity, input: TicketInput, requestId: string | null): Promise<SupportTicket> {
  const { row, email } = await deps.db.withUser(identity, async (tx) => {
    const user = await tx.selectFrom('users').select('email').where('id', '=', identity.userId).executeTakeFirstOrThrow();
    const row = await tx.insertInto('support_tickets').values({ user_id: identity.userId, topic: input.topic, message: input.message, request_id: requestId }).returningAll().executeTakeFirstOrThrow();
    return { row, email: user.email };
  });
  // The ticket is stored first; an email outage delays the inbox copy but never loses the ticket (R-09).
  await deps.email.send({
    to: deps.inbox,
    subject: `[NextKin support] ${input.topic} — ${row.id}`,
    text: [`Ticket ${row.id}`, `Topic: ${input.topic}`, `From: ${email}`, `Request id: ${requestId ?? 'none'}`, '', input.message].join('\n'),
  }).catch((error: unknown) => deps.log.error({ event: 'support.email_failed', ticketId: row.id, errorName: error instanceof Error ? error.name : typeof error }, 'support ticket stored but not emailed'));
  return { id: row.id, topic: input.topic, message: input.message, email, createdAt: new Date(row.created_at).toISOString() };
}
