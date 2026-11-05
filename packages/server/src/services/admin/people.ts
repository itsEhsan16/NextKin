import { sql } from 'kysely';

import type { Database, Tx } from '../../db/database';
import { FREE_QUOTAS, GRANTING } from '../plan';
import { dbRole, type Staff } from './permissions';

/**
 * The admin portal's People area over real rows (toreview §171.13): the Users page's headline
 * figures, and browsing every account with its plan, this month's use, resumes and last activity.
 * Everything is read through the read-only staff role (`withStaff`), with a recorded reason.
 *
 * Definitions, so each figure has a stated basis (G18):
 * - **Account:** a `users` row with role `user` (staff are listed on their own page). A deleted
 *   account waiting for its purge is not counted in the total.
 * - **Pro:** a subscription in a granting status (`plan.ts`'s `GRANTING`) on a Pro-tier plan,
 *   with a gateway subscription behind it. **Comped:** the same without one (`grantComp`).
 * - **Active:** recorded a product event (the apps send `app_opened`) or signed in within the
 *   window.
 */

export const PAGE_SIZE = 20;
const DAY = 86_400_000;
/** The fair-use cap an unlimited quota is drawn against (`services/billing.ts`). */
const FAIR_USE = 100;
/** A Pro plan's generation allowance when its row doesn't set one (`allowance` in `plan.ts`). */
const PRO_GENERATIONS = 100;

const reasonFor = (what: string) => `admin: ${what}`;
const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);

export type BrowseFilter = 'all' | 'free' | 'pro' | 'suspended' | 'deletion_pending';
export interface BrowseQuery {
  filter: BrowseFilter;
  q: string;
  sort: 'asc' | 'desc';
  page: number;
}

/** Users with a granting Pro subscription; comps (no gateway subscription) included. */
const proSubscribers = (tx: Tx) =>
  tx
    .selectFrom('subscriptions as s')
    .innerJoin('plans as p', 'p.id', 's.plan_id')
    .select('s.user_id')
    .where('s.status', 'in', [...GRANTING])
    .where('p.tier', '=', 'pro');

/** A percentage change, to a tenth; `null` when there is nothing to compare against. */
const percentChange = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

export async function userStats(db: Database, staff: Staff) {
  return db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, reasonFor('the Users page totals'), async (tx) => {
    const accounts = await sql<{ total: number; new30: number; suspended: number }>`
      select count(*) filter (where status <> 'deleted')::int as total,
             count(*) filter (where status <> 'deleted' and created_at >= now() - interval '30 days')::int as new30,
             count(*) filter (where status = 'suspended')::int as suspended
      from users where role = 'user'`.execute(tx);

    // Product events are kept for months but only began with 0047, so the previous window is
    // compared only once the record covers all of it; before that the change isn't known.
    const active = await sql<{ current: number; previous: number; covered: boolean }>`
      with seen as (
        select user_id, occurred_at as at from product_events where occurred_at >= now() - interval '60 days'
        union all
        select user_id, created_at from security_events where kind = 'sign_in' and created_at >= now() - interval '60 days'
      )
      select count(distinct seen.user_id) filter (where seen.at >= now() - interval '30 days')::int as current,
             count(distinct seen.user_id) filter (where seen.at < now() - interval '30 days')::int as previous,
             coalesce((select min(occurred_at) from product_events) <= now() - interval '60 days', false) as covered
      from seen join users u on u.id = seen.user_id and u.role = 'user' and u.status <> 'deleted'`.execute(tx);

    const pro = await sql<{ pro: number; pro_new: number; comped: number }>`
      select count(distinct s.user_id) filter (where s.gateway_subscription_id is not null)::int as pro,
             count(distinct s.user_id) filter (where s.gateway_subscription_id is not null and s.created_at >= now() - interval '30 days')::int as pro_new,
             count(distinct s.user_id) filter (where s.gateway_subscription_id is null)::int as comped
      from subscriptions s
      join plans p on p.id = s.plan_id
      join users u on u.id = s.user_id and u.role = 'user' and u.status <> 'deleted'
      where s.status in ('active', 'trialing', 'past_due') and p.tier = 'pro'`.execute(tx);

    // A suspension's reason code is the first part of its audit row's reason ("abuse: …").
    const reasons = await sql<{ code: string; n: number }>`
      select coalesce(split_part(l.reason, ':', 1), '') as code, count(*)::int as n
      from users u
      left join lateral (
        select reason from audit_logs
        where action = 'user.suspend' and target_type = 'user' and target_id = u.id::text
        order by created_at desc limit 1
      ) l on true
      where u.role = 'user' and u.status = 'suspended'
      group by 1`.execute(tx);

    const deletions = await sql<{ open: number; next_due: Date | null }>`
      select count(*)::int as open, min(due_at) filter (where due_at >= now()) as next_due
      from account_deletions where completed_at is null`.execute(tx);

    const a = accounts.rows[0]!;
    const act = active.rows[0]!;
    const p = pro.rows[0]!;
    const d = deletions.rows[0]!;
    const by = (code: string) => reasons.rows.find((r) => r.code === code)?.n ?? 0;
    const change = act.covered ? percentChange(act.current, act.previous) : null;
    return {
      total: a.total,
      newLast30: a.new30,
      active30: act.current,
      active30Delta: change === null ? null : { value: change, unit: 'percent' as const },
      pro: p.pro,
      proNew: p.pro_new,
      comped: p.comped,
      suspended: a.suspended,
      suspendedBy: { abuse: by('abuse'), fraud: by('fraud'), other: a.suspended - by('abuse') - by('fraud') },
      pendingDeletion: d.open,
      nextDeletionDueInDays: d.next_due ? Math.max(0, Math.ceil((new Date(d.next_due).getTime() - Date.now()) / DAY)) : null,
    };
  });
}

type RowStatus = 'active' | 'suspended' | 'deletion_pending' | 'comped' | 'unverified';

/** One status, the most pressing first (Figma 404:614). */
export function rowStatus(user: { status: string; email_verified: boolean }, comped: boolean): RowStatus {
  if (user.status === 'suspended') return 'suspended';
  if (user.status === 'deleted') return 'deletion_pending';
  if (comped) return 'comped';
  return user.email_verified ? 'active' : 'unverified';
}

/** A plan's monthly generation allowance, as `allowance` in `plan.ts` merges it, capped at fair use. */
export function generationLimit(tier: 'free' | 'pro', quotas: unknown): number {
  const raw = (quotas ?? {}) as Record<string, unknown>;
  const base = tier === 'free' ? FREE_QUOTAS.generation : PRO_GENERATIONS;
  const value = 'generation' in raw ? (raw.generation as number | null) : base;
  return value ?? FAIR_USE;
}

/** The facts each row shows, for a page of accounts at once. */
export async function rowFacts(tx: Tx, ids: string[]) {
  if (ids.length === 0) return new Map<string, RowFacts>();
  const subs = await tx
    .selectFrom('subscriptions as s')
    .innerJoin('plans as p', 'p.id', 's.plan_id')
    .select(['s.user_id', 's.gateway_subscription_id', 's.current_period_end', 's.created_at', 'p.quotas'])
    .where('s.user_id', 'in', ids)
    .where('s.status', 'in', [...GRANTING])
    .where('p.tier', '=', 'pro')
    .orderBy('s.created_at', 'desc')
    .execute();
  const free = await tx.selectFrom('plans').select('quotas').where('id', '=', 'free').executeTakeFirst();
  const used = await tx
    .selectFrom('usage_counters')
    .select(['user_id', 'used'])
    .where('user_id', 'in', ids)
    .where('metric', '=', 'generation')
    .where('period_start', '=', sql<Date>`date_trunc('month', now() at time zone 'utc')::date`)
    .execute();
  const resumes = await tx.selectFrom('resumes').select(['user_id', sql<number>`count(*)::int`.as('n')]).where('user_id', 'in', ids).groupBy('user_id').execute();
  const seen = await sql<{ user_id: string; at: Date | null }>`
    select u.id as user_id, greatest(
      (select max(last_seen_at) from sessions where user_id = u.id),
      (select max(occurred_at) from product_events where user_id = u.id),
      (select max(created_at) from security_events where user_id = u.id and kind = 'sign_in')
    ) as at
    from users u where u.id in (${sql.join(ids)})`.execute(tx);

  const facts = new Map<string, RowFacts>();
  for (const id of ids) {
    const sub = subs.find((s) => s.user_id === id);
    const plan: 'free' | 'pro' = sub ? 'pro' : 'free';
    facts.set(id, {
      plan,
      comped: Boolean(sub && !sub.gateway_subscription_id),
      compedUntil: sub && !sub.gateway_subscription_id ? iso(sub.current_period_end) : null,
      usage: { used: used.find((u) => u.user_id === id)?.used ?? 0, limit: generationLimit(plan, sub ? sub.quotas : free?.quotas) },
      resumes: resumes.find((r) => r.user_id === id)?.n ?? 0,
      lastActiveAt: iso(seen.rows.find((r) => r.user_id === id)?.at),
    });
  }
  return facts;
}

export interface RowFacts {
  plan: 'free' | 'pro';
  comped: boolean;
  compedUntil: string | null;
  usage: { used: number; limit: number };
  resumes: number;
  lastActiveAt: string | null;
}

const like = (term: string) => `%${term.replace(/[%_\\]/g, '\\$&')}%`;

/** Every account, filtered, searched (any length) and paged by sign-up date. */
export async function browseUsers(db: Database, staff: Staff, query: BrowseQuery) {
  return db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, reasonFor('browse users'), async (tx) => {
    let base = tx.selectFrom('users as u').where('u.role', '=', 'user');
    if (query.filter === 'suspended') base = base.where('u.status', '=', 'suspended');
    if (query.filter === 'deletion_pending') base = base.where('u.status', '=', 'deleted');
    if (query.filter === 'pro') base = base.where('u.id', 'in', proSubscribers(tx));
    if (query.filter === 'free') base = base.where('u.id', 'not in', proSubscribers(tx));
    const term = query.q.trim();
    if (term) {
      base = base.where((eb) =>
        eb.or([
          eb('u.email', 'ilike', like(term)),
          eb(sql`u.first_name || ' ' || u.last_name`, 'ilike', like(term)),
          eb(sql`u.id::text`, 'ilike', `${term.replace(/[%_\\]/g, '\\$&')}%`),
        ]),
      );
    }
    const { n } = await base.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
    const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
    const page = Math.min(Math.max(1, query.page), pages);
    const rows = await base
      .select(['u.id', 'u.email', 'u.first_name', 'u.last_name', 'u.status', 'u.email_verified', 'u.created_at'])
      .orderBy('u.created_at', query.sort)
      .orderBy('u.id', query.sort)
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .execute();
    const facts = await rowFacts(tx, rows.map((r) => r.id));
    return {
      rows: rows.map((r) => {
        const f = facts.get(r.id)!;
        return {
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          email: r.email,
          plan: f.plan,
          status: rowStatus(r, f.comped),
          usage: f.usage,
          signedUpAt: new Date(r.created_at).toISOString(),
          lastActiveAt: f.lastActiveAt,
          resumes: f.resumes,
        };
      }),
      matched: n,
      page,
      pages,
    };
  });
}
