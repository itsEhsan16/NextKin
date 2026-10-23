import { sql } from 'kysely';

import type { Database } from '../../db/database';
import { AppError, errors } from '../../http/errors';
import type { SecretsPort } from '../../secrets/secrets';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * The rest of the admin portal's back end (ImBackendImplementationPlan P12-05; spec §7.17):
 * templates (publishing gated on the Q-06 parse-back certification), plans and the price book,
 * job providers (enable, limits, a write-only key), aggregate analytics with AI spend, and the
 * rubric with its evidence. Every change writes an audit row in the same transaction.
 */

const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) }) as const;

// --- Templates -----------------------------------------------------------------------------

export async function listTemplates(db: Database, staff: Staff) {
  return db.withUser(staffDb(staff), (tx) => tx.selectFrom('resume_templates').select(['id', 'slug', 'name', 'ats_safe', 'certified_at', 'status', 'updated_at']).orderBy('slug').execute());
}

/** Publish (only a certified template: Q-06), unpublish, or archive (a template in use is archived, never deleted). */
export async function setTemplateStatus(db: Database, staff: Staff, slug: string, status: 'published' | 'draft' | 'archived', meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('resume_templates').select(['id', 'status', 'certified_at']).where('slug', '=', slug).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('template');
    if (status === 'published' && !before.certified_at) throw new AppError('CONFLICT', 'This template has not passed the parse-back certification (Q-06), so it cannot be published.', { reason: 'not_certified' });
    await tx.updateTable('resume_templates').set({ status }).where('id', '=', before.id).execute();
    await writeAudit(tx, staff, { action: `template.${status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish'}`, targetType: 'template', targetId: slug, before: { status: before.status }, after: { status } }, meta);
    return { slug, status };
  });
}

// --- Plans and the price book ------------------------------------------------------------------

export async function listPlans(db: Database, staff: Staff) {
  return db.withUser(staffDb(staff), (tx) => tx.selectFrom('plans').select(['id', 'tier', 'name', 'period', 'prices', 'price_version', 'quotas', 'active']).orderBy('id').execute());
}

/**
 * A new price-book version for a plan (§13.4): new checkouts use it; live subscriptions keep the
 * price the gateway holds for them. Minor units per currency.
 */
export async function setPlanPrices(db: Database, staff: Staff, planId: string, prices: Record<'USD' | 'EUR' | 'AUD', number>, meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('plans').select(['prices', 'price_version', 'tier']).where('id', '=', planId).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('plan');
    if (before.tier === 'free') throw errors.conflict('The Free plan has no price.');
    const after = await tx.updateTable('plans').set({ prices: JSON.stringify(prices), price_version: sql`price_version + 1` }).where('id', '=', planId).returning(['prices', 'price_version']).executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'plan.prices', targetType: 'plan', targetId: planId, before, after }, meta);
    return after;
  });
}

const QUOTA_KEYS = ['generation', 'ats_check', 'cover_letter', 'zero_resume', 'interview_set_per_resume', 'interview_set', 'assistant_message_daily', 'saved_jobs', 'versions_visible'] as const;

/** Per-plan quotas (§7.17). null is unlimited; every cap stays published (§13.1). */
export async function setPlanQuotas(db: Database, staff: Staff, planId: string, quotas: Partial<Record<(typeof QUOTA_KEYS)[number], number | null>>, meta: RequestMeta) {
  const unknown = Object.keys(quotas).filter((k) => !(QUOTA_KEYS as readonly string[]).includes(k));
  if (unknown.length) throw errors.validation({ quotas: `unknown: ${unknown.join(', ')}` });
  return db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('plans').select('quotas').where('id', '=', planId).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('plan');
    const merged = { ...(before.quotas as object), ...quotas };
    await tx.updateTable('plans').set({ quotas: JSON.stringify(merged) }).where('id', '=', planId).execute();
    await writeAudit(tx, staff, { action: 'plan.quotas', targetType: 'plan', targetId: planId, before: before.quotas, after: merged }, meta);
    return merged;
  });
}

// --- Job providers -------------------------------------------------------------------------

/** Never returns a key or its reference; only whether one is set. */
export async function listProviders(db: Database, staff: Staff) {
  const rows = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('job_provider_configs').select(['provider', 'enabled', 'priority', 'countries', 'limits', 'secret_ref', 'updated_at']).orderBy('priority').execute());
  return rows.map(({ secret_ref, ...r }) => ({ ...r, keySet: secret_ref !== null }));
}

/** Toggling a provider off removes it from search on the next registry refresh (30 s), no deployment. */
export async function updateProvider(db: Database, staff: Staff, provider: string, patch: { enabled?: boolean; priority?: number; dailyCalls?: number | null }, meta: RequestMeta) {
  return db.withUser(staffDb(staff), async (tx) => {
    const before = await tx.selectFrom('job_provider_configs').select(['enabled', 'priority', 'limits']).where('provider', '=', provider).forUpdate().executeTakeFirst();
    if (!before) throw errors.notFound('provider');
    const limits = patch.dailyCalls === undefined ? before.limits : { ...(before.limits as object), dailyCalls: patch.dailyCalls };
    const after = await tx
      .updateTable('job_provider_configs')
      .set({ ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), ...(patch.priority !== undefined ? { priority: patch.priority } : {}), limits: JSON.stringify(limits) })
      .where('provider', '=', provider)
      .returning(['enabled', 'priority', 'limits'])
      .executeTakeFirstOrThrow();
    await writeAudit(tx, staff, { action: 'provider.update', targetType: 'job_provider', targetId: provider, before, after }, meta);
    return after;
  });
}

/** Write-only (§7.17): stored through the secrets port; the response says only that a key is set. */
export async function setProviderKey(db: Database, secrets: SecretsPort, staff: Staff, provider: string, key: string, meta: RequestMeta) {
  const exists = await db.withUser(staffDb(staff), (tx) => tx.selectFrom('job_provider_configs').select('provider').where('provider', '=', provider).executeTakeFirst());
  if (!exists) throw errors.notFound('provider');
  const ref = await secrets.put(`job-provider/${provider}`, key);
  await db.withUser(staffDb(staff), async (tx) => {
    await tx.updateTable('job_provider_configs').set({ secret_ref: ref }).where('provider', '=', provider).execute();
    // The audit row records that the key changed, never the key.
    await writeAudit(tx, staff, { action: 'provider.key', targetType: 'job_provider', targetId: provider, after: { keySet: true } }, meta);
  });
  return { provider, keySet: true };
}

// --- Analytics (aggregate only, no PII) -----------------------------------------------------

export async function analytics(db: Database) {
  return db.withSystem('admin: aggregate analytics', async (tx) => {
    const one = async <T>(q: Promise<T>) => q;
    const users = await one(tx.selectFrom('users').select([sql<number>`count(*) filter (where role = 'user')::int`.as('total'), sql<number>`count(*) filter (where role = 'user' and created_at > now() - interval '30 days')::int`.as('last30')]).executeTakeFirstOrThrow());
    const runs = await tx.selectFrom('generations').select(['kind', 'status', sql<number>`count(*)::int`.as('n')]).where('created_at', '>', sql<Date>`now() - interval '30 days'`).groupBy(['kind', 'status']).execute();
    const scores = await tx
      .selectFrom('ats_reports')
      .select([sql<string>`(width_bucket(total_bps / 100.0, 0, 100, 10) * 10 - 10)::text`.as('bucket'), sql<number>`count(*)::int`.as('n')])
      .where('total_bps', 'is not', null)
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .execute();
    const spend = await tx.selectFrom('ai_calls').select(['tag', sql<number>`coalesce(sum(cost_micros), 0)::bigint`.as('micros'), sql<number>`count(*)::int`.as('calls')]).where('created_at', '>', sql<Date>`now() - interval '30 days'`).groupBy('tag').execute();
    const subs = await tx.selectFrom('subscriptions').select(['plan_id', 'status', sql<number>`count(*)::int`.as('n')]).groupBy(['plan_id', 'status']).execute();
    const usage = await tx.selectFrom('usage_counters').select(['metric', sql<number>`coalesce(sum(used), 0)::int`.as('used')]).where('period_start', '>=', sql<Date>`date_trunc('month', now() at time zone 'utc')::date`).groupBy('metric').execute();
    return {
      users,
      generationsLast30Days: runs,
      atsScoreDistribution: scores,
      aiSpendLast30Days: spend.map((s) => ({ tag: s.tag, usd: Number(s.micros) / 1e6, calls: s.calls })),
      subscriptions: subs,
      quotaUseThisMonth: usage,
    };
  });
}

// --- The rubric (G15) ------------------------------------------------------------------------

export async function listRubric(db: Database, staff: Staff) {
  return db.withUser(staffDb(staff), (tx) => tx.selectFrom('rubric_versions').select(['id', 'version', 'weights', 'bands', 'rationale', 'evidence', 'is_current', 'created_at']).orderBy('created_at', 'desc').execute());
}
