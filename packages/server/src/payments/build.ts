import type { Config } from '../config';
import { createFakeProvider, type FakeProvider } from './fake';
import { createStripeProvider } from './stripe';
import type { PaymentProvider } from './types';

/**
 * Builds the configured payment provider (P12-06). The fake delivers its webhooks through
 * `deliver`, which the API wires to its own webhook intake once the routes exist, so even locally a
 * plan changes only through a verified webhook.
 */
export type WebhookDelivery = (rawBody: string, headers: Record<string, string>) => Promise<void>;

export function buildPaymentProvider(config: Pick<Config, 'PAYMENT_ADAPTER' | 'STRIPE_API_BASE' | 'STRIPE_MOCK_URL' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'PAYMENT_FAKE_SECRET' | 'APP_ORIGIN'>, deliver: () => WebhookDelivery): PaymentProvider {
  switch (config.PAYMENT_ADAPTER) {
    case 'fake':
      return createFakeProvider({ secret: config.PAYMENT_FAKE_SECRET, apiOrigin: config.APP_ORIGIN, deliver });
    case 'stripeMock':
      // stripe-mock accepts any test key and checks request shapes; it never sends webhooks.
      return createStripeProvider({ apiBase: config.STRIPE_MOCK_URL, secretKey: config.STRIPE_SECRET_KEY ?? 'sk_test_stripe_mock', webhookSecret: config.STRIPE_WEBHOOK_SECRET ?? 'whsec_stripe_mock' });
    case 'stripe':
      return createStripeProvider({ apiBase: config.STRIPE_API_BASE, secretKey: config.STRIPE_SECRET_KEY!, webhookSecret: config.STRIPE_WEBHOOK_SECRET! });
  }
}

export const isFake = (provider: PaymentProvider): provider is FakeProvider => provider.name === 'fake';
