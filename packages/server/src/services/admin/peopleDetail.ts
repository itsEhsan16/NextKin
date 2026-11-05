import { sql } from 'kysely';

import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { dbRole, type Staff } from './permissions';
import { rowFacts, rowStatus } from './people';
import { inspectUser } from './users';

/**
 * One user for the admin portal's User detail page (Figma 406:2360), over real rows: what
 * `inspectUser` serves, plus the plan, comp, billing, the resumes' metadata, every security event
 * with its device, and what staff have done to the account. Resume content is never here; it opens
 * through the reason-gated read (`readUserResume`).
 *
 * Not served, because no table of ours holds it: the sign-in method and a user's MFA, which live
 * in the identity provider (Clerk or the local stand-in), not in our rows.
 */

const SOURCE: Record<string, string> = { uploaded: 'Upload', generated: 'Generated', zero_resume: 'Built from scratch', manual: 'Written' };

/** "Chrome on macOS" from a user agent; `null` when it names neither. */
export function deviceOf(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : /NextKin|okhttp|Expo/i.test(userAgent) ? 'NextKin app' : null;
  const os = /iPhone|iPad|iOS/.test(userAgent) ? (/iPad/.test(userAgent) ? 'iPad' : 'iPhone') : /Android/.test(userAgent) ? 'Android' : /Mac OS X|Macintosh/.test(userAgent) ? 'macOS' : /Windows/.test(userAgent) ? 'Windows' : /Linux/.test(userAgent) ? 'Linux' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}

/** The audit actions a user's Activity card shows, worded as the board words them. */
const ACTION: Record<string, { kind: string; label: string }> = {
  'user.password_reset': { kind: 'password_reset', label: 'Password reset email sent' },
  'user.content_read': { kind: 'content_read', label: 'Viewed resume content' },
  'user.suspend': { kind: 'suspended', label: 'Account suspended' },
  'user.reactivate': { kind: 'reactivated', label: 'Account reactivated' },
  'user.comp': { kind: 'comped', label: 'Pro access comped' },
  'user.delete': { kind: 'deletion_requested', label: 'Account deleted by staff' },
  'user.deletion_process': { kind: 'deletion_requested', label: 'Purge started early' },
};

/** "Priya R.": the first name and the last name's initial, as the boards name staff. */
const staffName = (first: string, last: string) => [first, last ? `${last[0]}.` : ''].filter(Boolean).join(' ').trim();

export async function userProfile(db: Database, staff: Staff, userId: string) {
  const base = await inspectUser(db, staff, userId);
  const extra = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: a user’s detail page', async (tx) => {
    const user = await tx.selectFrom('users').select(['status', 'email_verified']).where('id', '=', userId).executeTakeFirstOrThrow();
    const facts = (await rowFacts(tx, [userId])).get(userId)!;

    const sub = await tx
      .selectFrom('subscriptions as s')
      .innerJoin('plans as p', 'p.id', 's.plan_id')
      .innerJoin('billing_accounts as b', 'b.id', 's.billing_account_id')
      .select(['s.id', 's.created_at', 's.current_period_end', 's.cancel_at_period_end', 'p.period', 'b.billing_country', 'b.gateway_customer_id'])
      .where('s.user_id', '=', userId)
      .where('s.status', 'in', ['active', 'trialing', 'past_due'])
      .where('p.tier', '=', 'pro')
      .where('s.gateway_subscription_id', 'is not', null)
      .orderBy('s.created_at', 'desc')
      .executeTakeFirst();
    const payment = sub
      ? await tx.selectFrom('payments').select(['amount_minor', 'currency']).where('subscription_id', '=', sub.id).where('status', '=', 'succeeded').orderBy('occurred_at', 'desc').executeTakeFirst()
      : undefined;

    const resumes = await sql<{ id: string; created_at: Date; updated_at: Date; source: string; template: string | null; pages: number | null }>`
      select r.id, r.created_at, r.updated_at, r.source, t.name as template,
             (select rr.page_count from resume_renders rr where rr.resume_id = r.id and rr.status = 'ready' order by rr.created_at desc limit 1) as pages
      from resumes r left join resume_templates t on t.id = r.template_id
      where r.user_id = ${userId} and r.trashed_at is null
      order by r.updated_at desc`.execute(tx);

    const events = await tx.selectFrom('security_events').select(['id', 'kind', 'created_at', 'ip', 'user_agent']).where('user_id', '=', userId).orderBy('created_at', 'desc').limit(50).execute();
    const { n: eventCount } = await tx.selectFrom('security_events').select(sql<number>`count(*)::int`.as('n')).where('user_id', '=', userId).executeTakeFirstOrThrow();

    const actions = await sql<{ id: string; action: string; reason: string | null; created_at: Date; first_name: string | null; last_name: string | null }>`
      select l.id::text as id, l.action, l.reason, l.created_at, a.first_name, a.last_name
      from audit_logs l left join users a on a.id = l.actor_user_id
      where (l.target_type = 'user' and l.target_id = ${userId})
         or (l.target_type = 'resume' and l.after ->> 'userId' = ${userId})
      order by l.created_at desc limit 50`.execute(tx);

    return { user, facts, sub, payment, resumes: resumes.rows, events, eventCount, actions: actions.rows };
  });

  const { user, facts, sub, payment } = extra;
  return {
    ...base,
    plan: facts.plan,
    rowStatus: rowStatus(user, facts.comped),
    usageRow: facts.usage,
    lastActiveAt: facts.lastActiveAt,
    compedUntil: facts.compedUntil,
    // Billing needs a paid Pro subscription and a charge on it: the price is what was last charged.
    billing:
      sub && payment && sub.gateway_customer_id && (sub.period === 'month' || sub.period === 'year')
        ? {
            period: sub.period === 'month' ? 'monthly' : 'annual',
            since: new Date(sub.created_at).toISOString(),
            country: sub.billing_country ?? '—',
            priceMinor: Number(payment.amount_minor),
            currency: payment.currency.trim(),
            renewsAt: sub.current_period_end && !sub.cancel_at_period_end ? new Date(sub.current_period_end).toISOString() : null,
            stripeCustomer: sub.gateway_customer_id,
          }
        : null,
    resumeList: extra.resumes.map((r) => ({
      id: r.id,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      pages: r.pages,
      template: r.template,
      source: SOURCE[r.source] ?? r.source,
    })),
    events: extra.events.map((e) => ({ id: String(e.id), kind: e.kind, at: new Date(e.created_at).toISOString(), ip: e.ip, device: deviceOf(e.user_agent) })),
    securityEventCount: extra.eventCount,
    adminActions: extra.actions.flatMap((a) => {
      const known = ACTION[a.action];
      if (!known) return [];
      return [{ id: a.id, kind: known.kind, label: known.label, by: a.first_name !== null ? staffName(a.first_name, a.last_name ?? '') || 'Staff' : 'System', note: a.reason, at: new Date(a.created_at).toISOString() }];
    }),
  };
}

export const assertUserId = (userId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw errors.notFound('user');
};
