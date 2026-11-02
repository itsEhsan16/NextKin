import { GENERATION_KIND_LABEL, type GenerationKind } from '@nextkin/shared/models/generation';
import type { Notification, NotificationCategory, NotificationVisual } from '@nextkin/shared/models/notification';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { jobIdOf } from '../jobs/ids';
import { normalizedJobSchema } from '../jobs/types';
import type { Logger } from '../observability/logger';
import { notificationPrefs } from './profileRead';
import { queuePush } from './push';

/**
 * The notification feed (owner, 2026-10-31; changes D-05). A row records something that happened
 * on NextKin and nothing else: no employer event reaches us, so nothing here may say an application
 * was viewed or moved. Every row goes in the feed. The category switches choose what reaches the
 * lock screen, as NOTIF 04 says, so `notify` queues a push only for a category that's on.
 * One exception: a failed payment always pushes, because Pro is about to end (toreview §148.1). A row's
 * `dedupeKey` keeps a retried job from saying the same thing twice.
 */

export const FEED_LIMIT = 100;
export const RETENTION_DAYS = 90;
/** How long before a saved job closes the candidate hears about it (NOTIF 04's caption). */
const CLOSING_HOURS = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CLOSING_ROWS = 5000;

export interface NewNotification {
  category: NotificationCategory;
  body: string;
  description: string;
  deepLink?: string;
  visual: NotificationVisual;
  dedupeKey: string;
  /** Which nudge wins a morning, lower first; only the categories in `NUDGES` use it. */
  pushRank?: number;
  /** Reaches the lock screen even with its category switched off: a failed payment (toreview §148.1). */
  pushAlways?: boolean;
}

/** What we choose to raise, rather than the result of something they did: 9am, one a day. */
const NUDGES: ReadonlySet<NotificationCategory> = new Set(['matches', 'closing', 'applications']);

/** The push is the row's words: its headline without the emphasis, and its grey line. */
const plainText = (body: string): string => body.replace(/\*\*/g, '');

interface Row {
  id: string;
  category: string;
  body: string;
  description: string;
  deep_link: string | null;
  visual: unknown;
  read_at: Date | null;
  created_at: Date;
}

const COLUMNS = ['id', 'category', 'body', 'description', 'deep_link', 'visual', 'read_at', 'created_at'] as const;

const toNotification = (row: Row): Notification => ({
  id: row.id,
  category: row.category as NotificationCategory,
  body: row.body,
  description: row.description,
  createdAt: row.created_at.toISOString(),
  read: row.read_at !== null,
  ...(row.deep_link ? { deepLink: row.deep_link } : {}),
  visual: row.visual as NotificationVisual,
});

/** Files one notification, inside the transaction of what it reports, as its owner. */
export async function notify(tx: Tx, userId: string, item: NewNotification): Promise<void> {
  const profile = await tx.selectFrom('profiles').select('preferences').where('user_id', '=', userId).executeTakeFirst();
  const row = await tx
    .insertInto('notifications')
    .values({
      user_id: userId,
      category: item.category,
      body: item.body,
      description: item.description,
      deep_link: item.deepLink ?? null,
      visual: JSON.stringify(item.visual),
      dedupe_key: item.dedupeKey,
    })
    .onConflict((oc) => oc.columns(['user_id', 'dedupe_key']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const prefs = notificationPrefs(profile?.preferences);
  if (!row || (!prefs.categories[item.category] && !item.pushAlways)) return;
  await queuePush(tx, userId, prefs, {
    title: plainText(item.body),
    body: item.description,
    notificationId: row.id,
    nudge: NUDGES.has(item.category),
    ...(item.deepLink ? { url: item.deepLink } : {}),
    ...(item.pushRank === undefined ? {} : { rank: item.pushRank }),
  });
}

/** "for Stripe": the company a run's document targets, when it has one. */
async function runTarget(tx: Tx, resumeId: string | null): Promise<string> {
  if (!resumeId) return '';
  const resume = await tx.selectFrom('resumes').select('target_company').where('id', '=', resumeId).executeTakeFirst();
  return resume?.target_company ? ` for ${resume.target_company}` : '';
}

interface FinishedRun {
  id: string;
  user_id: string;
  kind: string;
  resume_id: string | null;
}

/** The kinds a person waits for; a section rewrite happens in the editor, in front of them. */
const kindLabel = (kind: string): string | null => GENERATION_KIND_LABEL[kind as GenerationKind] ?? null;

export async function notifyRunReady(tx: Tx, run: FinishedRun): Promise<void> {
  const label = kindLabel(run.kind);
  if (!label) return;
  await notify(tx, run.user_id, {
    category: 'ai',
    body: `**${label}${await runTarget(tx, run.resume_id)}** is ready`,
    description: 'Open it to review and download.',
    deepLink: `/generations/${run.id}`,
    visual: { kind: 'glyph', icon: 'check-circle', tone: 'success' },
    dedupeKey: `run:${run.id}:ready`,
  });
}

export async function notifyRunFailed(tx: Tx, run: FinishedRun): Promise<void> {
  const label = kindLabel(run.kind);
  if (!label) return;
  await notify(tx, run.user_id, {
    category: 'ai',
    body: `**${label}${await runTarget(tx, run.resume_id)}** didn’t finish`,
    description: 'Nothing was charged. Open it to try again.',
    deepLink: `/generations/${run.id}`,
    visual: { kind: 'glyph', icon: 'exclamation-triangle', tone: 'warning' },
    dedupeKey: `run:${run.id}:failed`,
  });
}

/** Plan and payment events, in the words of what happened. */
export const BILLING_NOTICE = {
  upgraded: { body: '**You’re on NextKin Pro**', description: 'Your plan is active.' },
  paid: { body: 'Payment received', description: 'Your invoice is in your email.' },
  failed: { body: '**Your payment didn’t go through**', description: 'Update your card to keep Pro.' },
  ended: { body: 'Your Pro plan has ended', description: 'You’re on the Free plan now.' },
} as const;

export const notifyBilling = (tx: Tx, userId: string, notice: keyof typeof BILLING_NOTICE, dedupeKey: string): Promise<void> =>
  notify(tx, userId, { category: 'billing', ...BILLING_NOTICE[notice], deepLink: '/upgrade', visual: { kind: 'glyph', icon: 'credit-card', tone: 'brand', regular: true }, dedupeKey: `billing:${dedupeKey}`, ...(notice === 'failed' ? { pushAlways: true } : {}) });

const closesIn = (days: number): string => (days <= 1 ? 'closes tomorrow' : `closes in ${days} days`);

/**
 * "Saved job closing soon": the daily job. Found as the system (across users), filed as each owner.
 * Idempotent: one alert per saved listing, however many runs see it.
 */
export async function runClosingAlerts(db: Database, log: Logger, now = new Date()): Promise<number> {
  const saved = await db.withSystem('notifications: saved jobs that have a closing date', (tx) =>
    tx
      .selectFrom('saved_jobs')
      .select(['user_id', 'apply_url_hash', 'snapshot'])
      .where('expired_at', 'is', null)
      .where(sql<boolean>`snapshot ? 'closingAt'`)
      .limit(MAX_CLOSING_ROWS)
      .execute(),
  );
  let filed = 0;
  for (const row of saved) {
    const parsed = normalizedJobSchema.safeParse(row.snapshot);
    if (!parsed.success || !parsed.data.closingAt) continue;
    const left = new Date(parsed.data.closingAt).getTime() - now.getTime();
    if (!(left > 0 && left <= CLOSING_HOURS * 60 * 60 * 1000)) continue;
    const job = parsed.data;
    await db.withUser({ userId: row.user_id, role: 'user' }, (tx) =>
      notify(tx, row.user_id, {
        category: 'closing',
        body: `**${job.company}** — ${job.title} **${closesIn(Math.ceil(left / DAY_MS))}**`,
        description: 'You saved this job.',
        deepLink: `/jobs/${jobIdOf(row.apply_url_hash)}`,
        visual: { kind: 'glyph', icon: 'clock', tone: 'warning', regular: true },
        dedupeKey: `closing:${row.apply_url_hash}`,
        pushRank: 1,
      }),
    );
    filed++;
  }
  if (saved.length === MAX_CLOSING_ROWS) log.warn({ event: 'notifications.closing_capped', rows: saved.length }, 'closing alerts read the row cap');
  return filed;
}

/** The feed keeps 90 days. */
export async function purgeNotifications(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  const result = await db.withSystem('maintenance: delete notifications past retention', (tx) => tx.deleteFrom('notifications').where('created_at', '<', cutoff).executeTakeFirst());
  return Number(result.numDeletedRows);
}

export const listNotifications = (db: Database, identity: Identity): Promise<Notification[]> =>
  db.withUser(identity, async (tx) => {
    const rows = await tx.selectFrom('notifications').select(COLUMNS).where('user_id', '=', identity.userId).orderBy('created_at', 'desc').limit(FEED_LIMIT).execute();
    return rows.map((row) => toNotification(row as Row));
  });

export async function markRead(db: Database, identity: Identity, id: string): Promise<Notification> {
  return db.withUser(identity, async (tx) => {
    const row = await tx.updateTable('notifications').set({ read_at: sql`coalesce(read_at, now())` }).where('id', '=', id).returning(COLUMNS).executeTakeFirst();
    if (!row) throw errors.notFound('notification');
    return toNotification(row as Row);
  });
}

export async function markAllRead(db: Database, identity: Identity): Promise<void> {
  await db.withUser(identity, (tx) => tx.updateTable('notifications').set({ read_at: sql`now()` }).where('user_id', '=', identity.userId).where('read_at', 'is', null).execute());
}

export async function removeNotification(db: Database, identity: Identity, id: string): Promise<void> {
  const result = await db.withUser(identity, (tx) => tx.deleteFrom('notifications').where('id', '=', id).executeTakeFirst());
  if (Number(result.numDeletedRows) === 0) throw errors.notFound('notification');
}
