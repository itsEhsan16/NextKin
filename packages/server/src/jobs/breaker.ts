import type { KvCache } from '../cache/kv';
import type { ProviderName } from './types';

/**
 * A circuit breaker and a daily quota per provider (ImBackendImplementationPlan P11-02; V2 §9.11
 * `cb:<provider>`). Three failures in a row open the breaker; after a cool-down one probe is let
 * through, and its success closes it again. State lives in Valkey so every web task agrees, with
 * single-key operations only. When Valkey itself is down the breaker fails open, as the rate
 * limiter does: an unavailable cache must not take search down with it.
 */

export interface BreakerState {
  failures: number;
  openedAt: number | null;
}

export interface Breaker {
  allow(provider: ProviderName): Promise<boolean>;
  success(provider: ProviderName): Promise<void>;
  failure(provider: ProviderName): Promise<void>;
  /** Counts a call against today's quota; false once the provider's daily quota is spent. */
  spend(provider: ProviderName, dailyCalls: number | undefined): Promise<boolean>;
}

export function createBreaker(kv: KvCache, options: { threshold?: number; coolDownMs?: number; now?: () => number } = {}): Breaker {
  const threshold = options.threshold ?? 3;
  const coolDownMs = options.coolDownMs ?? 60_000;
  const now = options.now ?? Date.now;
  const key = (p: ProviderName) => `cb:${p}`;
  const read = async (p: ProviderName): Promise<BreakerState> => (await kv.get<BreakerState>(key(p)).catch(() => null)) ?? { failures: 0, openedAt: null };

  return {
    async allow(provider) {
      const state = await read(provider);
      if (state.openedAt === null) return true;
      if (now() - state.openedAt < coolDownMs) return false;
      // Half-open: exactly one caller gets the probe.
      return kv.setNX(`${key(provider)}:probe`, 1, Math.ceil(coolDownMs / 1000)).catch(() => true);
    },
    async success(provider) {
      await kv.set(key(provider), { failures: 0, openedAt: null }, 24 * 3600).catch(() => undefined);
      await kv.del(`${key(provider)}:probe`).catch(() => undefined);
    },
    async failure(provider) {
      const state = await read(provider);
      const failures = state.failures + 1;
      const openedAt = failures >= threshold ? now() : state.openedAt;
      await kv.set(key(provider), { failures, openedAt }, 24 * 3600).catch(() => undefined);
      await kv.del(`${key(provider)}:probe`).catch(() => undefined);
    },
    async spend(provider, dailyCalls) {
      if (dailyCalls === undefined) return true;
      const day = new Date(now()).toISOString().slice(0, 10);
      const used = await kv.incr(`quota:${provider}:${day}`, 26 * 3600).catch(() => 0);
      return used <= dailyCalls;
    },
  };
}
