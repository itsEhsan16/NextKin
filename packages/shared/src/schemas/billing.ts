import { z } from 'zod';

import type { Billing } from '../models/billing';
import type { Plan } from '../models/plan';
import type { Subscription } from '../models/user';

/** Billing, plans and the subscription on the wire (ImBackendImplementationPlan P12-06…P12-10; V2 §13). */

const currency = z.enum(['INR', 'USD', 'EUR', 'AUD']);

export const subscriptionSchema = z.object({
  plan: z.enum(['free', 'pro']),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'paused', 'expired']),
  renewsAt: z.string().optional(),
  planId: z.enum(['free', 'pro_monthly', 'pro_annual']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  pausedUntil: z.string().optional(),
  usage: z.object({
    generationsUsed: z.number(),
    generationsLimit: z.number(),
    coverLettersUsed: z.number(),
    coverLettersLimit: z.number(),
    resumesUsed: z.number(),
    resumesLimit: z.number(),
    aiCreditsLeft: z.number(),
    atsChecksUsed: z.number().optional(),
    atsChecksLimit: z.number().optional(),
    assistantMessagesUsed: z.number().optional(),
    assistantMessagesLimit: z.number().optional(),
    interviewSetsUsed: z.number().optional(),
    interviewSetsLimit: z.number().optional(),
    resetsAt: z.string().optional(),
    assistantResetsAt: z.string().optional(),
  }),
}) satisfies z.ZodType<Subscription>;

export const planSchema = z.object({
  id: z.enum(['free', 'pro_monthly', 'pro_annual']),
  tier: z.enum(['free', 'pro']),
  name: z.string(),
  price: z.object({ amount: z.number(), currency, period: z.enum(['month', 'year']) }),
  badge: z.string().optional(),
  blurb: z.string(),
}) satisfies z.ZodType<Plan>;
export const planListSchema = z.object({ data: z.array(planSchema) });

export const billingSchema = z.object({
  paymentMethods: z.array(z.object({ id: z.string(), brand: z.enum(['visa', 'mastercard', 'amex']), last4: z.string(), expMonth: z.number(), expYear: z.number(), isDefault: z.boolean() })),
  settings: z.object({ autoRenew: z.boolean(), cycle: z.enum(['monthly', 'annual']) }),
  invoices: z.array(
    z.object({ id: z.string(), issuedOn: z.string(), description: z.string(), amount: z.object({ amount: z.number(), currency }), tax: z.number().optional(), number: z.string().optional(), status: z.enum(['paid', 'open', 'refunded']) }),
  ),
}) satisfies z.ZodType<Billing>;

export const billingSettingsPatchSchema = z.object({ autoRenew: z.boolean().optional(), cycle: z.enum(['monthly', 'annual']).optional() }).strict();

export const checkoutBodySchema = z
  .object({
    planId: z.enum(['pro_monthly', 'pro_annual']),
    /** ISO 3166-1 alpha-2; decides the currency (§13.4) when the account has none yet. */
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    /** Where the checkout returns to, a path on this origin (web) — mobile opens the web flow (D-18). */
    returnPath: z.string().max(200).regex(/^\/(?!\/)/).optional(),
  })
  .strict();
export const checkoutResultSchema = z.object({ url: z.string() });

export const pauseBodySchema = z.object({ months: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict();
