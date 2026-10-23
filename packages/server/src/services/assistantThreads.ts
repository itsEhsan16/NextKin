import type { AssistantAttachment, AssistantConversation, AssistantMessage, AssistantThreadSummary } from '@nextkin/shared/models/assistant';
import type { Selectable } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import type { ChatMessages, ChatSessions } from '../db/types.generated';
import { errors } from '../http/errors';

/**
 * The assistant's chats (ImBackendImplementationPlan P11-09; V2 §7.16): the current one, the history,
 * and the rows the client reads. Answering a message is `services/assistant.ts`.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A reply still streaming after this long lost its writer (a restart): read as failed. */
const STALE_MS = 3 * 60 * 1000;
const TITLE_MAX = 40;

export type SessionRow = Selectable<ChatSessions>;
export type MessageRow = Selectable<ChatMessages>;

/** A new chat is named by its first question (the History row), as the mock names it. */
export function titleFor(text: string): string {
  const line = text.trim().replace(/\s+/g, ' ');
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,.;:]+$/, '')}…`;
}

export function toMessage(row: MessageRow): AssistantMessage {
  const stale = row.status === 'streaming' && Date.now() - new Date(row.created_at).getTime() > STALE_MS;
  return {
    id: row.id,
    role: row.role as AssistantMessage['role'],
    text: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    status: stale ? 'failed' : (row.status as AssistantMessage['status']),
    ...(row.refusal ? { refusal: 'off_topic' as const } : {}),
    ...(row.context_resume_id ? { contextResumeId: row.context_resume_id } : {}),
    ...(Array.isArray(row.attachments) && row.attachments.length ? { attachments: row.attachments as AssistantAttachment[] } : {}),
  };
}

function toConversation(session: SessionRow, messages: MessageRow[]): AssistantConversation {
  return {
    id: session.id,
    ...(session.title ? { title: session.title } : {}),
    createdAt: new Date(session.created_at).toISOString(),
    updatedAt: new Date(session.updated_at).toISOString(),
    messages: messages.map(toMessage),
  };
}

const messagesOf = (tx: Tx, sessionId: string) => tx.selectFrom('chat_messages').selectAll().where('session_id', '=', sessionId).orderBy('created_at').orderBy('id').execute();

/** The chat the composer writes to; made on first use. */
export async function currentSession(tx: Tx, userId: string): Promise<SessionRow> {
  const found = await tx.selectFrom('chat_sessions').selectAll().where('is_current', '=', true).executeTakeFirst();
  if (found) return found;
  await tx
    .insertInto('chat_sessions')
    .values({ user_id: userId, is_current: true })
    .onConflict((oc) => oc.column('user_id').where('is_current', '=', true).doNothing())
    .execute();
  return tx.selectFrom('chat_sessions').selectAll().where('is_current', '=', true).executeTakeFirstOrThrow();
}

export async function getConversation(db: Database, identity: Identity): Promise<AssistantConversation> {
  return db.withUser(identity, async (tx) => {
    const session = await currentSession(tx, identity.userId);
    return toConversation(session, await messagesOf(tx, session.id));
  });
}

export async function listThreads(db: Database, identity: Identity): Promise<AssistantThreadSummary[]> {
  const rows = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('chat_sessions as s')
      .select([
        's.id',
        's.title',
        's.is_current',
        's.updated_at',
        (eb) => eb.selectFrom('chat_messages as m').select('m.content').whereRef('m.session_id', '=', 's.id').where('m.role', '=', 'user').orderBy('m.created_at').limit(1).as('first_question'),
        (eb) => eb.selectFrom('chat_messages as m').select('m.content').whereRef('m.session_id', '=', 's.id').where('m.role', '=', 'assistant').where('m.content', '<>', '').orderBy('m.created_at').limit(1).as('first_answer'),
      ])
      .where((eb) => eb.exists(eb.selectFrom('chat_messages as m').select('m.id').whereRef('m.session_id', '=', 's.id')))
      .orderBy('s.is_current', 'desc')
      .orderBy('s.updated_at', 'desc')
      .limit(50)
      .execute(),
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? titleFor(r.first_question ?? 'New chat'),
    preview: r.first_answer ?? '',
    updatedAt: new Date(r.updated_at).toISOString(),
    current: r.is_current,
  }));
}

/** Makes an earlier chat the current one; the one it replaces goes back to the history (or away, if empty). */
export async function openThread(db: Database, identity: Identity, id: string): Promise<AssistantConversation> {
  if (!UUID.test(id)) throw errors.notFound('chat');
  return db.withUser(identity, async (tx) => {
    const chosen = await tx.selectFrom('chat_sessions').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
    if (!chosen) throw errors.notFound('chat');
    if (!chosen.is_current) {
      const current = await tx.selectFrom('chat_sessions').select('id').where('is_current', '=', true).forUpdate().executeTakeFirst();
      if (current) {
        const used = await tx.selectFrom('chat_messages').select('id').where('session_id', '=', current.id).limit(1).executeTakeFirst();
        if (used) await tx.updateTable('chat_sessions').set({ is_current: false }).where('id', '=', current.id).execute();
        else await tx.deleteFrom('chat_sessions').where('id', '=', current.id).execute();
      }
      await tx.updateTable('chat_sessions').set({ is_current: true }).where('id', '=', id).execute();
    }
    const session = await tx.selectFrom('chat_sessions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    return toConversation(session, await messagesOf(tx, id));
  });
}

/** Files the current chat in the history, if it has anything in it, and starts an empty one. */
export async function startNew(db: Database, identity: Identity): Promise<AssistantConversation> {
  return db.withUser(identity, async (tx) => {
    const current = await currentSession(tx, identity.userId);
    const used = await tx.selectFrom('chat_messages').select('id').where('session_id', '=', current.id).limit(1).executeTakeFirst();
    if (!used) return toConversation(current, []);
    await tx.updateTable('chat_sessions').set({ is_current: false }).where('id', '=', current.id).execute();
    const fresh = await currentSession(tx, identity.userId);
    return toConversation(fresh, []);
  });
}

/** Empties the current chat; it is named again by its next first question. */
export async function clearConversation(db: Database, identity: Identity): Promise<AssistantConversation> {
  return db.withUser(identity, async (tx) => {
    const current = await currentSession(tx, identity.userId);
    await tx.deleteFrom('chat_messages').where('session_id', '=', current.id).execute();
    const session = await tx.updateTable('chat_sessions').set({ title: null }).where('id', '=', current.id).returningAll().executeTakeFirstOrThrow();
    return toConversation(session, []);
  });
}

export async function getMessage(db: Database, identity: Identity, id: string): Promise<AssistantMessage> {
  if (!UUID.test(id)) throw errors.notFound('message');
  const row = await db.withUser(identity, (tx) => tx.selectFrom('chat_messages').selectAll().where('id', '=', id).executeTakeFirst());
  if (!row) throw errors.notFound('message');
  return toMessage(row);
}
