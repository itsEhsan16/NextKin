import { sql } from 'kysely';

import type { Database, Tx } from '../../db/database';
import { errors } from '../../http/errors';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * The Business pages' records beyond `catalog.ts` (toreview §171.13): the price book's history and a
 * new version of it, the comped-access list and ending a comp, how many people are on each plan,
 * and each job provider's traffic, errors, key and pause. Every change writes its audit row in the
 * same transaction. Staff are named by their own name; a user only by a masked id on screen.
 */

const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;
type Prices = Record<'USD' | 'EUR' | 'AUD', number>;

/** A staff member as an audit row names them: their name, else their email, with the role they acted as. */
const staffName = sql<string>`coalesce(nullif(trim(u.first_name || ' ' || u.last_name), ''), u.email)`;

// --- The price book -------------------------------------------------------------------------

/** Read as the system: naming the author joins `users`, which RLS hides from a staff session. */
export async function listPriceBook(db: Database) {
  return db.withSystem('admin: the price book', async (tx) => {
    const { rows } = await sql<{ version: number; effective_from: Date; monthly: Prices; annual: Prices; name: string | null; role: string | null }>`
      SELECT v.version, v.effective_from, v.monthly, v.annual, ${staffName} AS name, u.role
      FROM app.price_book_versions v LEFT JOIN app.users u ON u.id = v.created_by
      ORDER BY v.version DESC`.execute(tx);
    return rows.map((row, index) => ({
      version: row.version,
      effectiveFrom: new Date(row.effective_from).toISOString(),
      monthly: row.monthly,
      annual: row.annual,
      // Version 1 came from the seed, with no author.
      createdBy: row.name ? { name: row.name, role: row.role } : null,
      status: index === 0 ? 'active' : 'retired',
    }));
  });
}

/**
 * A new price-book version (§13.4): the Pro monthly and annual prices together, in one transaction,
 * so the two plans never disagree about which version is current. New checkouts use it; live
 * subscriptions keep the price the gateway holds for them.
 */
export async function createPriceVersion(db: Database, staff: Staff, input: { monthly: Prices; annual: Prices }, meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const plans = await tx.selectFrom('plans').select(['id', 'prices', 'price_version']).where('id', 'in', ['pro_monthly', 'pro_annual']).forUpdate().execute();
    if (plans.length !== 2) throw errors.notFound('plan');
    const same = (a: unknown, b: Prices) => (['USD', 'EUR', 'AUD'] as const).every((c) => (a as Partial<Prices> | null)?.[c] === b[c]);
    const current = Object.fromEntries(plans.map((plan) => [plan.id, plan.prices]));
    // Nothing would change: no new version, and no audit row saying something did.
    if (same(current.pro_monthly, input.monthly) && same(current.pro_annual, input.annual)) throw errors.conflict('These are already the current prices.');
    const last = await tx.selectFrom('price_book_versions').select(sql<number>`coalesce(max(version), 0)`.as('v')).executeTakeFirstOrThrow();
    const version = Number(last.v) + 1;
    await tx.insertInto('price_book_versions').values({ version, monthly: JSON.stringify(input.monthly), annual: JSON.stringify(input.annual), created_by: staff.identity.userId }).execute();
    for (const [id, prices] of [['pro_monthly', input.monthly], ['pro_annual', input.annual]] as const) {
      await tx.updateTable('plans').set({ prices: JSON.stringify(prices), price_version: sql`price_version + 1` }).where('id', '=', id).execute();
    }
    await writeAudit(tx, staff, { action: 'plan.price_book', targetType: 'plan', targetId: `price_book_v${version}`, before: current, after: { version, ...input } }, meta);
    return { version };
  });
}

// --- Plans ----------------------------------------------------------------------------------

/**
 * Accounts on each plan now: a subscription in a status that grants its tier (`services/plan.ts`
 * GRANTING), comps included; Free is every other active user account. When each plan's quotas last
 * changed, and who changed them, from the audit log.
 */
export async function planStats(db: Database) {
  return db.withSystem('admin: accounts per plan', async (tx) => {
    const { rows } = await sql<{ plan_id: string; n: number }>`
      SELECT s.plan_id, count(DISTINCT s.user_id)::int AS n FROM app.subscriptions s
      JOIN app.users u ON u.id = s.user_id AND u.role = 'user' AND u.status = 'active'
      WHERE s.status IN ('active', 'trialing', 'past_due') GROUP BY 1`.execute(tx);
    const users = await sql<{ n: number }>`SELECT count(*)::int AS n FROM app.users WHERE role = 'user' AND status = 'active'`.execute(tx);
    const paying = rows.reduce((sum, row) => sum + Number(row.n), 0);
    const changes = await sql<{ target_id: string; created_at: Date; name: string }>`
      SELECT DISTINCT ON (a.target_id) a.target_id, a.created_at, ${staffName} AS name
      FROM app.audit_logs a LEFT JOIN app.users u ON u.id = a.actor_user_id
      WHERE a.action = 'plan.quotas' ORDER BY a.target_id, a.created_at DESC`.execute(tx);
    const active: Record<string, number> = { free: Math.max(0, Number(users.rows[0]?.n ?? 0) - paying) };
    for (const row of rows) active[row.plan_id] = Number(row.n);
    return {
      active,
      quotasChanged: Object.fromEntries(changes.rows.map((row) => [row.target_id, { at: new Date(row.created_at).toISOString(), by: row.name }])),
    };
  });
}

// --- Comped access --------------------------------------------------------------------------

const COMPS_PER_PAGE = 10;

/**
 * Comps still running: a subscription with no gateway id (`users.grantComp`) still granting Pro.
 * The reason and who granted it come from the grant's audit row, the newest `user.comp` for that
 * user written when the subscription was created.
 */
export async function listComps(db: Database, page: number) {
  return db.withSystem('admin: list comped access', async (tx) => {
    const where = sql`s.gateway_subscription_id IS NULL AND s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > now())`;
    const count = await sql<{ n: number }>`SELECT count(*)::int AS n FROM app.subscriptions s WHERE ${where}`.execute(tx);
    const active = Number(count.rows[0]?.n ?? 0);
    const pages = Math.max(1, Math.ceil(active / COMPS_PER_PAGE));
    const current = Math.min(Math.max(1, page), pages);
    const { rows } = await sql<{ id: string; user_id: string; created_at: Date; current_period_end: Date | null; reason: string | null; name: string | null; role: string | null }>`
      SELECT s.id, s.user_id, s.created_at, s.current_period_end, a.reason, ${staffName} AS name, a.actor_role AS role
      FROM app.subscriptions s
      LEFT JOIN LATERAL (
        SELECT reason, actor_user_id, actor_role FROM app.audit_logs
        WHERE action = 'user.comp' AND target_id = s.user_id::text AND created_at >= s.created_at - interval '1 minute'
        ORDER BY created_at LIMIT 1
      ) a ON true
      LEFT JOIN app.users u ON u.id = a.actor_user_id
      WHERE ${where}
      ORDER BY s.created_at DESC LIMIT ${COMPS_PER_PAGE} OFFSET ${(current - 1) * COMPS_PER_PAGE}`.execute(tx);
    return {
      rows: rows.map((row) => {
        const started = new Date(row.created_at);
        const ends = row.current_period_end ? new Date(row.current_period_end) : null;
        return {
          id: row.id,
          userId: row.user_id,
          months: ends ? Math.max(1, Math.round((ends.getTime() - started.getTime()) / (30.44 * 86_400_000))) : null,
          reason: row.reason,
          grantedBy: row.name ? { name: row.name, role: row.role } : null,
          startedAt: started.toISOString(),
          endsAt: ends?.toISOString() ?? null,
        };
      }),
      page: current,
      pages,
      active,
    };
  });
}

/** Ends a comp now: the subscription stops granting Pro (it is cancelled, never deleted). */
export async function endComp(db: Database, staff: Staff, id: string, meta: RequestMeta) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw errors.notFound('comp');
  return db.withSystem(`admin ${staff.identity.userId}: end comped access`, async (tx: Tx) => {
    const sub = await tx.selectFrom('subscriptions').select(['id', 'user_id', 'status', 'current_period_end', 'gateway_subscription_id']).where('id', '=', id).forUpdate().executeTakeFirst();
    if (!sub || sub.gateway_subscription_id !== null) throw errors.notFound('comp');
    if (sub.status !== 'trialing') throw errors.conflict('This comp has already ended.');
    await tx.updateTable('subscriptions').set({ status: 'canceled', current_period_end: sql`now()` }).where('id', '=', id).execute();
    await writeAudit(tx, staff, { action: 'user.comp_end', targetType: 'user', targetId: sub.user_id, before: { status: sub.status, until: sub.current_period_end }, after: { status: 'canceled' } }, meta);
    return { id };
  });
}

// --- Job providers --------------------------------------------------------------------------

/**
 * Each provider's calls today against its ceiling, today's error rate and the last seven days'
 * (oldest first, days with no calls left out), when its key was set and by whom, and who paused it.
 */
export async function providerStats(db: Database) {
  return db.withSystem('admin: job provider traffic', async (tx) => {
    const { rows } = await sql<{ provider: string; day: string; calls: number; errors: number }>`
      SELECT provider, day::text AS day, calls, errors FROM app.job_provider_calls
      WHERE day > (now() AT TIME ZONE 'utc')::date - 7 ORDER BY day`.execute(tx);
    const today = new Date().toISOString().slice(0, 10);
    const audit = await sql<{ target_id: string; action: string; after: { enabled?: boolean } | null; created_at: Date; name: string }>`
      SELECT DISTINCT ON (a.target_id, a.action) a.target_id, a.action, a.after, a.created_at, ${staffName} AS name
      FROM app.audit_logs a LEFT JOIN app.users u ON u.id = a.actor_user_id
      WHERE a.target_type = 'job_provider' AND a.action IN ('provider.key', 'provider.update')
      ORDER BY a.target_id, a.action, a.created_at DESC`.execute(tx);
    const providers = new Set([...rows.map((row) => row.provider), ...audit.rows.map((row) => row.target_id)]);
    return Object.fromEntries(
      [...providers].map((provider) => {
        const days = rows.filter((row) => row.provider === provider && Number(row.calls) > 0);
        const todayRow = days.find((row) => row.day === today);
        const key = audit.rows.find((row) => row.target_id === provider && row.action === 'provider.key');
        const update = audit.rows.find((row) => row.target_id === provider && row.action === 'provider.update');
        return [
          provider,
          {
            callsToday: Number(todayRow?.calls ?? 0),
            errorRate: todayRow ? Number(todayRow.errors) / Number(todayRow.calls) : null,
            errorTrend: days.map((row) => Number(row.errors) / Number(row.calls)),
            keyAddedAt: key ? new Date(key.created_at).toISOString() : null,
            keyAddedBy: key?.name ?? null,
            // The newest change switched it off: that is who paused it.
            pausedBy: update?.after?.enabled === false ? { name: update.name, at: new Date(update.created_at).toISOString() } : null,
          },
        ];
      }),
    );
  });
}
