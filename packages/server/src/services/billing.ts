import type { Billing, CardBrand, Invoice } from '@nextkin/shared/models/billing';
import type { Plan, PlanId } from '@nextkin/shared/models/plan';
import type { Subscription, SubscriptionStatus } from '@nextkin/shared/models/user';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import type { EmailPort } from '../email/email';
import { AppError, errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { currencyFor, toMajor } from '../payments/priceBook';
import type { Currency, PaidPlanId, PaymentProvider } from '../payments/types';
import { GRANTING, planOf } from './plan';

/**
 * Billing (ImBackendImplementationPlan P12-06…P12-10; V2 §13). The account, its subscription and
 * its payments live in our tables and change only through verified webhooks (`billingWebhooks.ts`);
 * the routes here read them, start a hosted checkout, and ask the gateway for a change (cancel,
 * pause, resume, a new cycle, the 14-day withdrawal), whose result arrives as a webhook in turn.
 */

export interface BillingDeps {
  db: Database;
  provider: PaymentProvider;
  email: EmailPort;
  appOrigin: string;
  log: Logger;
}

/** §13.3's published fair-use figure stands in where Pro has no hard cap (the mock does the same). */
const FAIR_USE = 100;
const WITHDRAWAL_DAYS = 14;

const BLURB: Record<PlanId, string> = {
  free: 'Three resume generations a month, with clean PDF export and no watermark.',
  pro_monthly: 'Higher caps, DOCX export and a priority generation queue. Cancel any time.',
  pro_annual: 'The same Pro, paid once a year instead of twelve times.',
};
const NAME: Record<PlanId, string> = { free: 'Free', pro_monthly: 'Pro monthly', pro_annual: 'Pro annual' };

type PlanRow = { id: string; tier: string; period: string | null; prices: unknown; price_version: number };

async function planRows(db: Database): Promise<PlanRow[]> {
  return db.withAnonymous((tx) => tx.selectFrom('plans').select(['id', 'tier', 'period', 'prices', 'price_version']).where('active', '=', true).orderBy('id').execute());
}

const priceOf = (row: PlanRow, currency: Currency) => Number((row.prices as Record<string, number>)[currency] ?? 0);

/** The billing account (one per user in Release 1, §17.3), made on first use. */
export async function accountOf(tx: Tx, userId: string, country?: string | null) {
  await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).onConflict((oc) => oc.column('owner_user_id').doNothing()).execute();
  let account = await tx.selectFrom('billing_accounts').selectAll().where('owner_user_id', '=', userId).executeTakeFirstOrThrow();
  if (country && !account.billing_country && /^[A-Z]{2}$/.test(country)) {
    account = await tx.updateTable('billing_accounts').set({ billing_country: country, currency: currencyFor(country) }).where('id', '=', account.id).returningAll().executeTakeFirstOrThrow();
  }
  return account;
}

/** The plans in the account's currency (or the country asked about), with the annual saving computed, rounded down. */
export async function listPlans(db: Database, identity: Identity | null, country?: string): Promise<Plan[]> {
  let currency: Currency = currencyFor(country);
  if (!country && identity) {
    const account = await db.withUser(identity, (tx) => tx.selectFrom('billing_accounts').select(['currency', 'billing_country']).where('owner_user_id', '=', identity.userId).executeTakeFirst());
    if (account?.currency) currency = account.currency as Currency;
  }
  const rows = await planRows(db);
  const monthly = rows.find((r) => r.id === 'pro_monthly');
  const annual = rows.find((r) => r.id === 'pro_annual');
  const overAYear = monthly ? priceOf(monthly, currency) * 12 : 0;
  const saving = annual && overAYear > 0 ? Math.floor(((overAYear - priceOf(annual, currency)) / overAYear) * 100) : 0;
  return rows
    .filter((r): r is PlanRow & { id: PlanId } => r.id === 'free' || r.id === 'pro_monthly' || r.id === 'pro_annual')
    .map((r) => ({
      id: r.id,
      tier: r.tier as Plan['tier'],
      name: NAME[r.id],
      price: { amount: toMajor(priceOf(r, currency)), currency, period: (r.period ?? 'month') as 'month' | 'year' },
      ...(r.id === 'pro_annual' && saving > 0 ? { badge: `Save ${saving}%` } : {}),
      blurb: BLURB[r.id],
    }));
}

const monthEnd = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
};
const dayEnd = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
};

/** The account's subscription and its meters (§13.3, §13.5), from our tables only. */
export async function getSubscription(db: Database, identity: Identity): Promise<Subscription> {
  return db.withUser(identity, async (tx) => {
    const plan = await planOf(tx, identity.userId);
    const sub = await tx.selectFrom('subscriptions').selectAll().where('user_id', '=', identity.userId).orderBy('created_at', 'desc').executeTakeFirst();
    const counters = await tx
      .selectFrom('usage_counters')
      .select(['metric', 'used', sql<string>`period_start::text`.as('period_start')])
      .where('user_id', '=', identity.userId)
      .where((eb) => eb.or([eb('period_start', '=', sql<Date>`date_trunc('month', now() at time zone 'utc')::date`), eb('period_start', '=', sql<Date>`(now() at time zone 'utc')::date`)]))
      .execute();
    const month = (metric: string) => counters.find((c) => c.metric === metric && metric !== 'assistant_message')?.used ?? 0;
    const today = counters.find((c) => c.metric === 'assistant_message')?.used ?? 0;
    const sets = await tx.selectFrom('interview_question_sets').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
    const q = plan.quotas;
    const cap = (n: number | null) => n ?? FAIR_USE;
    const generationsUsed = month('generation');
    const status: SubscriptionStatus = !sub || plan.tier === 'free' ? (sub && sub.status !== 'expired' && sub.status !== 'canceled' ? (sub.status as SubscriptionStatus) : 'active') : (sub.status as SubscriptionStatus);
    return {
      plan: plan.tier,
      status,
      ...(sub?.current_period_end && plan.tier === 'pro' ? { renewsAt: new Date(sub.current_period_end).toISOString() } : {}),
      planId: plan.planId as Subscription['planId'],
      ...(sub && plan.tier === 'pro' ? { cancelAtPeriodEnd: sub.cancel_at_period_end } : {}),
      ...(sub?.paused_until ? { pausedUntil: new Date(sub.paused_until).toISOString() } : {}),
      usage: {
        generationsUsed,
        generationsLimit: cap(q.generation),
        coverLettersUsed: month('cover_letter'),
        coverLettersLimit: cap(q.cover_letter),
        // The board's "resumes" meter is the generation meter: every generated resume is one.
        resumesUsed: generationsUsed,
        resumesLimit: cap(q.generation),
        aiCreditsLeft: Math.max(0, cap(q.generation) - generationsUsed),
        atsChecksUsed: month('ats_check'),
        atsChecksLimit: cap(q.ats_check),
        assistantMessagesUsed: today,
        assistantMessagesLimit: plan.assistantDaily,
        interviewSetsUsed: Number(sets.n),
        interviewSetsLimit: cap(q.interview_set_per_resume),
        resetsAt: monthEnd(),
        assistantResetsAt: dayEnd(),
      },
    };
  });
}

/** Starts a hosted checkout (§13.4). The plan changes only when its verified webhook lands. */
export async function startCheckout(deps: BillingDeps, identity: Identity, planId: PaidPlanId, options: { country?: string; returnPath?: string }): Promise<{ url: string }> {
  const { account, email, current } = await deps.db.withUser(identity, async (tx) => {
    const account = await accountOf(tx, identity.userId, options.country ?? null);
    const user = await tx.selectFrom('users').select(['email']).where('id', '=', identity.userId).executeTakeFirstOrThrow();
    const current = await tx.selectFrom('subscriptions').select(['plan_id', 'status']).where('user_id', '=', identity.userId).where('status', 'in', [...GRANTING, 'paused']).executeTakeFirst();
    return { account, email: user.email, current };
  });
  if (current) throw errors.conflict('You already have NextKin Pro. Change the billing cycle in Billing settings instead.');
  const row = (await planRows(deps.db)).find((r) => r.id === planId);
  if (!row) throw errors.notFound('plan');
  const country = account.billing_country ?? options.country ?? 'US';
  const currency = (account.currency as Currency | null) ?? currencyFor(country);
  const amountMinor = priceOf(row, currency);
  if (amountMinor <= 0) throw errors.unavailable('That plan has no price in your currency yet.');
  const back = `${deps.appOrigin.replace(/\/$/, '')}${options.returnPath && options.returnPath.startsWith('/') && !options.returnPath.startsWith('//') ? options.returnPath : '/upgrade'}`;
  const { url } = await gatewayCall(deps, () => deps.provider.createCheckout({
    billingAccountId: account.id,
    userId: identity.userId,
    email,
    customerRef: account.gateway_customer_id,
    planId,
    period: (row.period ?? 'month') as 'month' | 'year',
    amountMinor,
    currency,
    country,
    priceVersion: row.price_version,
    successUrl: `${back}?checkout=success`,
    cancelUrl: `${back}?checkout=cancelled`,
  }));
  return { url };
}

/**
 * A gateway call. When the gateway is down the answer is a plain 503 and the degraded banner shows
 * (R-09); the plan and its features are untouched, because they are read from our tables.
 */
async function gatewayCall<T>(deps: BillingDeps, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AppError) throw error;
    deps.log.warn({ event: 'billing.gateway_failed', errorName: error instanceof Error ? error.name : typeof error }, 'payment gateway call failed');
    throw errors.unavailable('Upgrades and billing changes are paused for a moment. Your plan is unaffected; try again shortly.');
  }
}

async function liveSubscription(db: Database, identity: Identity) {
  const sub = await db.withUser(identity, (tx) =>
    tx.selectFrom('subscriptions').selectAll().where('user_id', '=', identity.userId).where('status', 'in', [...GRANTING, 'paused']).orderBy('created_at', 'desc').executeTakeFirst(),
  );
  if (!sub?.gateway_subscription_id) throw errors.conflict('There is no paid subscription to change.');
  return sub as typeof sub & { gateway_subscription_id: string };
}

/** The Settings board: the card on file, the renewal settings and the invoices, newest first. */
export async function getBilling(db: Database, identity: Identity): Promise<Billing> {
  return db.withUser(identity, async (tx) => {
    const account = await tx.selectFrom('billing_accounts').select(['card']).where('owner_user_id', '=', identity.userId).executeTakeFirst();
    const sub = await tx.selectFrom('subscriptions as s').innerJoin('plans as p', 'p.id', 's.plan_id').select(['s.cancel_at_period_end', 'p.period']).where('s.user_id', '=', identity.userId).orderBy('s.created_at', 'desc').executeTakeFirst();
    const payments = await tx.selectFrom('payments').selectAll().where('user_id', '=', identity.userId).orderBy('occurred_at', 'desc').limit(100).execute();
    const card = account?.card as { brand: CardBrand; last4: string; expMonth: number; expYear: number } | null | undefined;
    const invoices: Invoice[] = payments
      .filter((p) => p.status !== 'failed' && p.status !== 'pending')
      .map((p) => ({
        id: p.id,
        issuedOn: new Date(p.occurred_at).toISOString().slice(0, 10),
        description: 'NextKin Pro',
        amount: { amount: toMajor(Number(p.amount_minor)), currency: p.currency as Currency },
        ...(Number(p.tax_minor) > 0 ? { tax: toMajor(Number(p.tax_minor)) } : {}),
        ...(p.invoice_number ? { number: p.invoice_number } : {}),
        status: p.status === 'refunded' ? 'refunded' : 'paid',
      }));
    return {
      paymentMethods: card ? [{ id: 'card_default', ...card, isDefault: true }] : [],
      settings: { autoRenew: sub ? !sub.cancel_at_period_end : true, cycle: sub?.period === 'year' ? 'annual' : 'monthly' },
      invoices,
    };
  });
}

/** Auto-renew off is a period-end cancellation (§13.4); a new cycle is a plan change the gateway prorates. */
export async function updateBillingSettings(deps: BillingDeps, identity: Identity, patch: { autoRenew?: boolean; cycle?: 'monthly' | 'annual' }): Promise<Billing> {
  const sub = await liveSubscription(deps.db, identity);
  if (patch.autoRenew !== undefined && patch.autoRenew === sub.cancel_at_period_end) await gatewayCall(deps, () => deps.provider.setCancelAtPeriodEnd(sub.gateway_subscription_id, !patch.autoRenew));
  if (patch.cycle) {
    const planId: PaidPlanId = patch.cycle === 'annual' ? 'pro_annual' : 'pro_monthly';
    if (planId !== sub.plan_id) {
      const row = (await planRows(deps.db)).find((r) => r.id === planId)!;
      const account = await deps.db.withUser(identity, (tx) => accountOf(tx, identity.userId));
      const currency = (account.currency as Currency | null) ?? 'USD';
      await gatewayCall(deps, () => deps.provider.changePlan(sub.gateway_subscription_id, planId, priceOf(row, currency), currency, (row.period ?? 'month') as 'month' | 'year'));
    }
  }
  return getBilling(deps.db, identity);
}

/** The Kündigungsbutton (§13.4): cancel in one step, effective at period end, confirmed by email. */
export async function cancelSubscription(deps: BillingDeps, identity: Identity): Promise<Subscription> {
  const sub = await liveSubscription(deps.db, identity);
  await gatewayCall(deps, () => deps.provider.setCancelAtPeriodEnd(sub.gateway_subscription_id, true));
  const user = await deps.db.withUser(identity, (tx) => tx.selectFrom('users').select('email').where('id', '=', identity.userId).executeTakeFirstOrThrow());
  const end = sub.current_period_end ? new Date(sub.current_period_end).toISOString().slice(0, 10) : 'the end of your billing period';
  await deps.email.send({ to: user.email, subject: 'Your NextKin Pro cancellation', text: `Your NextKin Pro subscription is cancelled. You keep Pro until ${end}, and you will not be charged again.\n\nYour resumes, versions and exports stay in your account on Free.` }).catch((e: unknown) => deps.log.warn({ event: 'billing.cancel_email_failed', errorName: e instanceof Error ? e.name : typeof e }, 'cancel email failed'));
  return getSubscription(deps.db, identity);
}

/** §13.6: pause for one to three months instead of cancelling. */
export async function pauseSubscription(deps: BillingDeps, identity: Identity, months: 1 | 2 | 3): Promise<Subscription> {
  const sub = await liveSubscription(deps.db, identity);
  if (sub.status === 'paused') throw errors.conflict('Your subscription is already paused.');
  const until = new Date();
  until.setUTCMonth(until.getUTCMonth() + months);
  await gatewayCall(deps, () => deps.provider.pause(sub.gateway_subscription_id, until));
  return getSubscription(deps.db, identity);
}

export async function resumeSubscription(deps: BillingDeps, identity: Identity): Promise<Subscription> {
  const sub = await liveSubscription(deps.db, identity);
  if (sub.status === 'paused') await gatewayCall(deps, () => deps.provider.resume(sub.gateway_subscription_id));
  else if (sub.cancel_at_period_end) await gatewayCall(deps, () => deps.provider.setCancelAtPeriodEnd(sub.gateway_subscription_id, false));
  return getSubscription(deps.db, identity);
}

/**
 * The statutory 14-day withdrawal right (Germany; §13.4, P12-10): within 14 days of the first
 * payment, the subscription ends now and that payment is refunded in full.
 */
export async function withdraw(deps: BillingDeps, identity: Identity): Promise<Subscription> {
  const sub = await liveSubscription(deps.db, identity);
  const first = await deps.db.withUser(identity, (tx) =>
    tx.selectFrom('payments').select(['gateway_payment_id', 'occurred_at']).where('subscription_id', '=', sub.id).where('status', '=', 'succeeded').orderBy('occurred_at', 'asc').executeTakeFirst(),
  );
  const since = first ? Date.now() - new Date(first.occurred_at).getTime() : 0;
  if (since > WITHDRAWAL_DAYS * 24 * 3600 * 1000) throw new AppError('CONFLICT', 'The 14-day withdrawal period has passed. You can still cancel, effective at the end of the period.');
  await gatewayCall(deps, () => deps.provider.cancelNowAndRefund(sub.gateway_subscription_id, first?.gateway_payment_id ?? null));
  return getSubscription(deps.db, identity);
}
