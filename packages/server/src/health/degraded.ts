import type { KvCache } from '../cache/kv';
import type { EmailPort } from '../email/email';
import type { PaymentProvider } from '../payments/types';

/**
 * Degraded modes (ImBackendImplementationPlan P13-02, R-09). When an external capability fails, the
 * product keeps working around it, and both apps say so in one banner instead of failing silently.
 *
 * An adapter failure marks its capability degraded in Valkey for a few minutes; a success clears it.
 * Every web task and the worker therefore agree, and a capability heals on its own once nothing
 * re-marks it. `/health/features` reads the marks (public, no PII). When Valkey itself is down the
 * signal reports nothing degraded rather than adding a second outage.
 */

export const CAPABILITIES = ['ai', 'jobs', 'payments', 'email'] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** What the banner says for each capability: what still works, in plain words. */
export const DEGRADED_MESSAGE: Record<Capability, string> = {
  ai: 'Writing and checking are paused or slower than usual. Your work is saved; try again in a few minutes.',
  jobs: 'Job search is showing fewer listings than usual. Your saved jobs are safe.',
  payments: 'Upgrades and billing changes are paused for a moment. Your plan and features are unaffected.',
  email: 'Emails from NextKin may arrive late.',
};

const MARK_SECONDS = 5 * 60;
const key = (c: Capability) => `degraded:${c}`;

export interface DegradedSignal {
  mark(capability: Capability): Promise<void>;
  clear(capability: Capability): Promise<void>;
  read(): Promise<{ capability: Capability; degraded: boolean; since?: string; message?: string }[]>;
}

export function createDegradedSignal(kv: KvCache): DegradedSignal {
  return {
    async mark(capability) {
      // Keeps the first time it was seen, so the banner can say how long it has lasted.
      const since = (await kv.get<{ since: string }>(key(capability)).catch(() => null))?.since ?? new Date().toISOString();
      await kv.set(key(capability), { since }, MARK_SECONDS).catch(() => undefined);
    },
    async clear(capability) {
      await kv.del(key(capability)).catch(() => undefined);
    },
    async read() {
      return Promise.all(
        CAPABILITIES.map(async (capability) => {
          const mark = await kv.get<{ since: string }>(key(capability)).catch(() => null);
          return mark ? { capability, degraded: true, since: mark.since, message: DEGRADED_MESSAGE[capability] } : { capability, degraded: false };
        }),
      );
    },
  };
}

/** A no-op signal, for tests and processes with nowhere to record it. */
export const NO_SIGNAL: DegradedSignal = { mark: async () => {}, clear: async () => {}, read: async () => CAPABILITIES.map((capability) => ({ capability, degraded: false })) };

/** Runs a call and records its outcome on the capability's signal. */
export async function observed<T>(signal: DegradedSignal, capability: Capability, call: () => Promise<T>): Promise<T> {
  try {
    const value = await call();
    await signal.clear(capability);
    return value;
  } catch (error) {
    await signal.mark(capability);
    throw error;
  }
}

/** Email whose failures mark `email` degraded (and whose successes clear it). */
export function observedEmail(email: EmailPort, signal: DegradedSignal): EmailPort {
  return { send: (message) => observed(signal, 'email', () => email.send(message)) };
}

/** A payment provider whose gateway calls mark `payments`. Webhook verification is not a gateway call. */
export function observedPayments(provider: PaymentProvider, signal: DegradedSignal): PaymentProvider {
  const calls = ['createCheckout', 'setCancelAtPeriodEnd', 'pause', 'resume', 'cancelNowAndRefund', 'changePlan'] as const;
  const wrapped: Record<string, unknown> = { ...provider };
  for (const name of calls) {
    const fn = provider[name] as ((...args: unknown[]) => Promise<unknown>) | undefined;
    if (fn) wrapped[name] = (...args: unknown[]) => observed(signal, 'payments', () => fn.apply(provider, args));
  }
  return wrapped as unknown as PaymentProvider;
}
