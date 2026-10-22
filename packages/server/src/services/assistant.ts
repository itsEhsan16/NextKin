import { greetingAnswer } from '@nextkin/shared/assistant/answers';
import { greetingKind, REFUSAL_LINE, type GreetingKind } from '@nextkin/shared/assistant/domain';
import type { AssistantAttachment, AssistantMessage } from '@nextkin/shared/models/assistant';
import { sql } from 'kysely';

import type { AssistantBrain, Turn } from '../assistant/brain';
import type { Database, Identity } from '../db/database';
import { AppError, errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { contextFor } from './assistantContext';
import { currentSession, titleFor, toMessage, UUID } from './assistantThreads';
import { planOf } from './plan';
import { requireAiConsent } from './consent';

export { clearConversation, getConversation, getMessage, listThreads, openThread, startNew, titleFor } from './assistantThreads';

/**
 * The AI career assistant (ImBackendImplementationPlan P11-09; V2 §7.16). Read and advise only:
 * nothing here writes a resume, the profile or any other user data; the only writes are the chat
 * itself and the day's message count.
 *
 * A greeting or a thank-you ("Hi", "thanks!") is answered at once with a short hello: no model call,
 * and it does not count (owner, 2026-10-18; toreview §109). Any other message is counted first (the
 * daily cap, atomically; a refused one counts too, as the mock's meter does), then classified by the
 * fast tier. An out-of-scope message gets the fixed refusal at once, with no further model call. An
 * in-scope one is answered against the open document's context (its text, never a contact field or
 * the user's name; the requirement ledger included) and the last few turns, streamed into the reply
 * row, which the client reads as it grows (`GET /assistant/messages/{id}`).
 */

export interface AssistantDeps {
  db: Database;
  brain: AssistantBrain;
  log: Logger;
  /** Replies still being written, so a test (or a draining process) can wait for them. */
  pending?: Set<Promise<void>>;
}

const HISTORY_TURNS = 6;
const TURN_CHARS = 1500;
const FLUSH_MS = 250;

const nextUtcMidnight = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
};

/** Counts one message against today's cap, atomically; refuses past it. */
async function chargeDaily(db: Database, identity: Identity): Promise<void> {
  await db.withUser(identity, async (tx) => {
    const { assistantDaily, tier } = await planOf(tx, identity.userId);
    const charged = await tx
      .insertInto('usage_counters')
      .values({
        user_id: identity.userId,
        metric: 'assistant_message',
        period_start: sql`(now() at time zone 'utc')::date`,
        period_end: sql`((now() at time zone 'utc')::date + 1)`,
        used: 1,
      })
      .onConflict((oc) =>
        oc
          .columns(['user_id', 'metric', 'period_start'])
          .doUpdateSet({ used: sql`usage_counters.used + 1`, updated_at: sql`now()` })
          .where('usage_counters.used', '<', assistantDaily),
      )
      .returning('used')
      .executeTakeFirst();
    if (!charged) {
      const resetsAt = nextUtcMidnight();
      const seconds = Math.max(60, Math.ceil((resetsAt.getTime() - Date.now()) / 1000));
      const message = tier === 'free' ? `You have used today’s ${assistantDaily} assistant messages. They reset at midnight UTC, or upgrade for more.` : `You have used today’s ${assistantDaily} assistant messages. They reset at midnight UTC.`;
      throw new AppError('RATE_LIMITED', message, { reason: 'assistant_daily', limit: assistantDaily, resetsAt: resetsAt.toISOString(), retryAfterSeconds: seconds }, { 'Retry-After': String(seconds) });
    }
  });
}

async function refundDaily(db: Database, identity: Identity): Promise<void> {
  await db.withUser(identity, (tx) =>
    tx
      .updateTable('usage_counters')
      .set({ used: sql`greatest(used - 1, 0)` })
      .where('metric', '=', 'assistant_message')
      .where('period_start', '=', sql<Date>`(now() at time zone 'utc')::date`)
      .execute(),
  );
}

export async function sendMessage(
  deps: AssistantDeps,
  identity: Identity,
  input: { text: string; resumeId?: string; attachments?: AssistantAttachment[] },
): Promise<{ user: AssistantMessage; reply: AssistantMessage }> {
  const { db, brain } = deps;
  await db.withUser(identity, (tx) => requireAiConsent(tx, identity.userId)); // P12-12, before the message counts
  const greeting = greetingKind(input.text);
  if (greeting) return answerGreeting(db, identity, input, greeting);
  await chargeDaily(db, identity);

  const { session, previous } = await db.withUser(identity, async (tx) => {
    const session = await currentSession(tx, identity.userId);
    const recent = await tx
      .selectFrom('chat_messages')
      .select(['role', 'content'])
      .where('session_id', '=', session.id)
      .where('status', '=', 'complete')
      .where('refusal', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(HISTORY_TURNS)
      .execute();
    // History is truncated: the last few turns, each cut to a paragraph.
    const previous: Turn[] = recent.reverse().map((m) => ({ role: m.role as Turn['role'], text: m.content.slice(0, TURN_CHARS) }));
    return { session, previous };
  });

  let verdict: Awaited<ReturnType<AssistantBrain['classify']>>;
  try {
    const hasAttachment = Boolean(input.resumeId) || Boolean(input.attachments?.length);
    verdict = await brain.classify({ text: input.text, previous, userId: identity.userId, hasAttachment });
  } catch (error) {
    // The message was never answered, so it does not count.
    await refundDaily(db, identity);
    deps.log.warn({ event: 'assistant.classify_failed', errorName: error instanceof Error ? error.name : typeof error }, 'assistant classifier failed');
    throw errors.unavailable('The assistant is not available right now. Try again in a moment.');
  }

  const resumeId = input.resumeId && UUID.test(input.resumeId) ? input.resumeId : undefined;
  const written = await db.withUser(identity, async (tx) => {
    const context = verdict.inScope && resumeId ? await contextFor(tx, identity.userId, resumeId) : null;
    const contextResumeId = context ? resumeId : undefined;
    const user = await tx
      .insertInto('chat_messages')
      .values({
        session_id: session.id,
        user_id: identity.userId,
        role: 'user',
        content: input.text,
        status: 'complete',
        context_resume_id: contextResumeId ?? null,
        attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const reply = await tx
      .insertInto('chat_messages')
      .values({
        session_id: session.id,
        user_id: identity.userId,
        role: 'assistant',
        content: verdict.inScope ? '' : REFUSAL_LINE,
        status: verdict.inScope ? 'streaming' : 'complete',
        // §7.16: a refusal is logged by topic class only.
        refusal: verdict.inScope ? null : 'off_topic',
        classification: JSON.stringify({ inScope: verdict.inScope, topic: verdict.topic }),
        context_resume_id: contextResumeId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await tx
      .updateTable('chat_sessions')
      .set({ title: session.title ?? titleFor(input.text), updated_at: sql`now()` })
      .where('id', '=', session.id)
      .execute();
    return { user, reply, context };
  });

  if (verdict.inScope && verdict.topic) {
    const job = streamReply(deps, identity, written.reply.id, { text: input.text, previous, userId: identity.userId, topic: verdict.topic, context: written.context });
    deps.pending?.add(job);
    void job.finally(() => deps.pending?.delete(job));
  }
  return { user: toMessage(written.user), reply: toMessage(written.reply) };
}

/** A greeting: both turns written complete at once, with the hello; nothing counted, no model. */
async function answerGreeting(db: Database, identity: Identity, input: { text: string; resumeId?: string; attachments?: AssistantAttachment[] }, kind: GreetingKind): Promise<{ user: AssistantMessage; reply: AssistantMessage }> {
  const resumeId = input.resumeId && UUID.test(input.resumeId) ? input.resumeId : undefined;
  return db.withUser(identity, async (tx) => {
    const session = await currentSession(tx, identity.userId);
    const context = resumeId ? await contextFor(tx, identity.userId, resumeId) : null;
    const contextResumeId = context ? resumeId : null;
    const user = await tx
      .insertInto('chat_messages')
      .values({ session_id: session.id, user_id: identity.userId, role: 'user', content: input.text, status: 'complete', context_resume_id: contextResumeId, attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null })
      .returningAll()
      .executeTakeFirstOrThrow();
    const reply = await tx
      .insertInto('chat_messages')
      .values({
        session_id: session.id,
        user_id: identity.userId,
        role: 'assistant',
        content: greetingAnswer(kind, context ?? undefined),
        status: 'complete',
        classification: JSON.stringify({ inScope: true, topic: 'product', greeting: kind }),
        context_resume_id: contextResumeId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await tx.updateTable('chat_sessions').set({ title: session.title ?? titleFor(input.text), updated_at: sql`now()` }).where('id', '=', session.id).execute();
    return { user: toMessage(user), reply: toMessage(reply) };
  });
}

/** Writes the reply into its row as it grows, a few times a second, then marks it complete. */
async function streamReply(deps: AssistantDeps, identity: Identity, id: string, input: Parameters<AssistantBrain['reply']>[0]): Promise<void> {
  let text = '';
  let flushed = 0;
  let last = Date.now();
  let writing: Promise<unknown> = Promise.resolve();
  const write = (status: 'streaming' | 'complete' | 'failed') =>
    deps.db.withUser(identity, (tx) => tx.updateTable('chat_messages').set({ content: text.slice(0, 20_000), status }).where('id', '=', id).execute());
  try {
    await deps.brain.reply(input, (delta) => {
      text += delta;
      if (Date.now() - last >= FLUSH_MS && text.length > flushed) {
        last = Date.now();
        flushed = text.length;
        writing = writing.then(() => write('streaming')).catch(() => undefined);
      }
    });
    await writing;
    await write(text.trim() ? 'complete' : 'failed');
  } catch (error) {
    await writing;
    deps.log.warn({ event: 'assistant.reply_failed', errorName: error instanceof Error ? error.name : typeof error }, 'assistant reply failed');
    await write('failed').catch(() => undefined);
  }
}
