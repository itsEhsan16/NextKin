import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import type { Database } from '../db/database';
import type { EmailPort } from '../email/email';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import { currencyFor, toMajor } from '../payments/priceBook';
import type { BillingEvent, PaymentProvider } from '../payments/types';

/**
 * Billing webhooks (ImBackendImplementationPlan P12-07; spec §9.8): **persist, then process.**
 *
 * - **ingest** verifies the signature, stores the event (unique on the provider's event id, so a
 *   replay stores nothing) and enqueues its processing in the same transaction (outbox). It answers
 *   the gateway at once.
 * - **process** (the worker) applies the event to our tables and marks it processed. It is
 *   idempotent: a processed event is skipped, a payment is unique on its gateway id and a
 *   subscription on its gateway id. An event that arrives before the one it depends on (an
 *   invoice before its checkout) throws and is redelivered later.
 *
 * Entitlements read only these tables (P12-08), so paying users keep their features while the
 * gateway is unreachable.
 */

export interface WebhookDeps {
  db: Database;
  provider: PaymentProvider;
  log: Logger;
}

export interface ProcessDeps extends WebhookDeps {
  email: EmailPort;
}

export class WebhookNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookNotReadyError';
  }
}

export async function ingestWebhook(deps: WebhookDeps, rawBody: string, headers: Record<string, string | undefined>): Promise<{ stored: boolean; id: string | null }> {
  const verified = await deps.provider.verifyWebhook(rawBody, headers);
  // The intake role may insert events but never read them (not even for ON CONFLICT), so the id is
  // minted here and a replay is the unique violation on (provider, event_id): the transaction rolls
  // back, nothing is stored and nothing is enqueued.
  const id = randomUUID();
  try {
    await deps.db.withAnonymous(async (tx) => {
      await tx.insertInto('webhook_events').values({ id, provider: deps.provider.name, event_id: verified.eventId, type: verified.providerType, payload: JSON.stringify(verified.payload) }).execute();
      await enqueue(tx, { queue: 'maintenance', groupId: `billing:${deps.provider.name}`, type: 'billing.webhook', payload: { webhookEventId: id }, correlationId: null });
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return { stored: false, id: null };
    throw error;
  }
  return { stored: true, id };
}

/** Applies one stored event. Returns false when it was already processed. */
export async function processWebhook(deps: ProcessDeps, id: string): Promise<boolean> {
  const event = await deps.db.withSystem('billing: read a stored webhook', (tx) => tx.selectFrom('webhook_events').selectAll().where('id', '=', id).executeTakeFirst());
  if (!event || event.processed_at) return false;
  try {
    await apply(deps, deps.provider.interpret(event.payload));
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'failed';
    await deps.db.withSystem('billing: record a webhook failure', (tx) => tx.updateTable('webhook_events').set({ error: message }).where('id', '=', id).execute());
    throw error;
  }
  await deps.db.withSystem('billing: mark a webhook processed', (tx) => tx.updateTable('webhook_events').set({ processed_at: sql`now()`, error: null }).where('id', '=', id).execute());
  return true;
}

/** Every stored, unprocessed event, oldest first (tests, and a drained queue's catch-up). */
export async function processPendingWebhooks(deps: ProcessDeps): Promise<number> {
  const pending = await deps.db.withSystem('billing: list unprocessed webhooks', (tx) => tx.selectFrom('webhook_events').select('id').where('processed_at', 'is', null).orderBy('received_at').limit(200).execute());
  let done = 0;
  for (const { id } of pending) {
    try {
      if (await processWebhook(deps, id)) done++;
    } catch (error) {
      // Recorded on the event (processWebhook does that); one stuck event never blocks the rest.
      deps.log.warn({ event: 'billing.webhook_failed', errorName: error instanceof Error ? error.name : typeof error }, 'webhook not applied');
    }
  }
  return done;
}

async function ownerOfAccount(db: Database, accountId: string) {
  const row = await db.withSystem('billing: find the account owner', (tx) => tx.selectFrom('billing_accounts').select(['id', 'owner_user_id']).where('id', '=', accountId).executeTakeFirst());
  if (!row) throw new WebhookNotReadyError(`billing account ${accountId} not found`);
  return row;
}

async function subscriptionByRef(db: Database, ref: string) {
  const row = await db.withSystem('billing: find a subscription by its gateway id', (tx) =>
    tx.selectFrom('subscriptions').select(['id', 'user_id', 'billing_account_id']).where('gateway_subscription_id', '=', ref).executeTakeFirst(),
  );
  if (!row) throw new WebhookNotReadyError(`subscription ${ref} not seen yet`);
  return row;
}

async function apply(deps: ProcessDeps, event: BillingEvent): Promise<void> {
  const { db } = deps;
  switch (event.type) {
    case 'checkout.completed': {
      const account = await ownerOfAccount(db, event.billingAccountId);
      await db.withUser({ userId: account.owner_user_id, role: 'user' }, async (tx) => {
        await tx
          .updateTable('billing_accounts')
          .set({ gateway: deps.provider.name, gateway_customer_id: event.customerRef, currency: event.currency, ...(event.country ? { billing_country: event.country } : {}) })
          .where('id', '=', account.id)
          .execute();
        await tx
          .insertInto('subscriptions')
          .values({ billing_account_id: account.id, user_id: account.owner_user_id, plan_id: event.planId, status: 'active', gateway_subscription_id: event.subscriptionRef, current_period_end: event.currentPeriodEnd })
          .onConflict((oc) => oc.column('gateway_subscription_id').doNothing())
          .execute();
        await tx.insertInto('activity').values({ user_id: account.owner_user_id, kind: 'plan', title: `Upgraded to **${event.planId === 'pro_annual' ? 'Pro annual' : 'Pro monthly'}**`, deep_link: '/upgrade' }).execute();
      });
      return;
    }
    case 'subscription.updated': {
      const sub = await subscriptionByRef(db, event.subscriptionRef);
      await db.withUser({ userId: sub.user_id, role: 'user' }, (tx) =>
        tx
          .updateTable('subscriptions')
          .set({
            status: event.status,
            cancel_at_period_end: event.cancelAtPeriodEnd,
            paused_until: event.pausedUntil,
            ...(event.currentPeriodEnd ? { current_period_end: event.currentPeriodEnd } : {}),
            ...(event.planId ? { plan_id: event.planId } : {}),
          })
          .where('id', '=', sub.id)
          .execute(),
      );
      return;
    }
    case 'subscription.deleted': {
      const sub = await subscriptionByRef(db, event.subscriptionRef);
      await db.withUser({ userId: sub.user_id, role: 'user' }, (tx) => tx.updateTable('subscriptions').set({ status: 'canceled', cancel_at_period_end: false, paused_until: null }).where('id', '=', sub.id).execute());
      return;
    }
    case 'invoice.paid': {
      const sub = await subscriptionByRef(db, event.subscriptionRef);
      const written = await db.withUser({ userId: sub.user_id, role: 'user' }, async (tx) => {
        const payment = await tx
          .insertInto('payments')
          .values({
            billing_account_id: sub.billing_account_id,
            user_id: sub.user_id,
            subscription_id: sub.id,
            gateway_payment_id: event.paymentRef,
            amount_minor: event.amountMinor,
            tax_minor: event.taxMinor,
            currency: event.currency,
            status: 'succeeded',
            occurred_at: event.occurredAt,
            invoice_number: sql<string>`'NK-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('app.invoice_number_seq')::text, 6, '0')`,
          })
          .onConflict((oc) => oc.column('gateway_payment_id').doNothing())
          .returning(['invoice_number'])
          .executeTakeFirst();
        if (event.card) await tx.updateTable('billing_accounts').set({ card: JSON.stringify(event.card) }).where('id', '=', sub.billing_account_id).execute();
        // A paid invoice clears a past-due state.
        await tx.updateTable('subscriptions').set({ status: 'active' }).where('id', '=', sub.id).where('status', '=', 'past_due').execute();
        const user = await tx.selectFrom('users as u').innerJoin('billing_accounts as b', 'b.owner_user_id', 'u.id').select(['u.email', 'b.billing_country']).where('u.id', '=', sub.user_id).executeTakeFirstOrThrow();
        return payment ? { number: payment.invoice_number, ...user } : null;
      });
      // §13.4: an invoice is emailed for every charge, with its tax shown.
      if (written) {
        const amount = toMajor(event.amountMinor).toFixed(2);
        const tax = toMajor(event.taxMinor).toFixed(2);
        const taxName = currencyFor(written.billing_country) === 'AUD' ? 'GST' : 'VAT';
        await deps.email
          .send({
            to: written.email,
            subject: `NextKin invoice ${written.number ?? ''}`.trim(),
            // The legal seller details (name, address, tax ids) join the invoice at X-13.
            text: [`Invoice ${written.number ?? ''}`, `Date: ${event.occurredAt.slice(0, 10)}`, 'NextKin Pro', `Total: ${amount} ${event.currency}`, event.taxMinor > 0 ? `Includes ${taxName}: ${tax} ${event.currency}` : 'No tax was charged on this invoice.', '', 'NextKin'].join('\n'),
          })
          .catch((e: unknown) => deps.log.warn({ event: 'billing.invoice_email_failed', errorName: e instanceof Error ? e.name : typeof e }, 'invoice email failed'));
      }
      return;
    }
    case 'invoice.payment_failed': {
      const sub = await subscriptionByRef(db, event.subscriptionRef);
      await db.withUser({ userId: sub.user_id, role: 'user' }, (tx) => tx.updateTable('subscriptions').set({ status: 'past_due' }).where('id', '=', sub.id).execute());
      return;
    }
    case 'charge.refunded': {
      const payment = await db.withSystem('billing: find a refunded payment', (tx) => tx.selectFrom('payments').select(['id', 'user_id']).where('gateway_payment_id', '=', event.paymentRef).executeTakeFirst());
      if (!payment) throw new WebhookNotReadyError(`payment ${event.paymentRef} not seen yet`);
      await db.withUser({ userId: payment.user_id, role: 'user' }, (tx) => tx.updateTable('payments').set({ status: 'refunded' }).where('id', '=', payment.id).execute());
      return;
    }
    case 'ignored':
      deps.log.info({ event: 'billing.webhook_ignored', providerType: event.providerType }, 'webhook type not handled');
      return;
  }
}
