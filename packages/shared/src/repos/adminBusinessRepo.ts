import {
  adminAnalyticsFixture,
  adminCompsFixture,
  adminJobProvidersFixture,
  adminPlansFixture,
  adminPriceBookFixture,
} from '../mock/fixtures/adminBusiness';
import { adminMeFixture } from '../mock/fixtures/admin';
import { simulate } from '../mock/delay';
import type {
  AdminAnalyticsPage,
  AdminJobProvider,
  AdminPlan,
  AnalyticsRange,
  CompGrant,
  CompInput,
  CompPage,
  PriceSet,
  PriceVersion,
  PriceVersionInput,
} from '../models/adminBusiness';

import { auditRef, recordAdminAudit } from './adminAuditLog';
import { onAdminMockReset } from './adminMockReset';
import { clone } from './state';

/**
 * A change the rules refuse: the Free plan has no price, a price can't be zero, a ceiling can't be
 * negative. `code` is what the screen branches on.
 */
export class BusinessRefusedError extends Error {
  readonly code:
    | 'free_plan_price'
    | 'invalid_price'
    | 'invalid_quota'
    | 'invalid_ceiling'
    | 'invalid_key'
    | 'invalid_comp'
    | 'not_found';

  constructor(code: BusinessRefusedError['code'], message: string) {
    super(message);
    this.name = 'BusinessRefusedError';
    this.code = code;
  }
}

/** Comped access is listed four to a page, as the board draws it (406:3352). */
export const COMPS_PAGE_SIZE = 4;

/**
 * The Business area (Figma 406:2873, 407:1430, 408:3596). A method that returns `null` has no
 * source on the backend yet (`toreview.md` §171.4); the mock answers every one.
 */
export interface AdminBusinessRepo {
  plans(): Promise<AdminPlan[]>;
  /** The price history; `null` where only the current prices are served. */
  priceBook(): Promise<PriceVersion[] | null>;
  /** One page of comped access; `null` where no list is served. */
  comps(page: number): Promise<CompPage | null>;
  /** A new price version for both Pro plans; the one it replaces is retired, never edited. */
  createPriceVersion(input: PriceVersionInput): Promise<void>;
  /** One plan's prices. Refused for the Free plan, which has none. */
  setPlanPrices(planId: string, prices: PriceSet): Promise<AdminPlan>;
  /** A plan's quotas by key; `null` makes a quota unlimited. */
  setQuotas(planId: string, quotas: Record<string, number | null>): Promise<AdminPlan>;
  grantComp(input: CompInput): Promise<void>;
  endComp(id: string): Promise<void>;
  analytics(range: AnalyticsRange): Promise<AdminAnalyticsPage>;
  providers(): Promise<AdminJobProvider[]>;
  setProviderEnabled(provider: string, enabled: boolean): Promise<AdminJobProvider>;
  setProviderCeiling(provider: string, dailyCalls: number): Promise<AdminJobProvider>;
  /** Stores a key. Write-only: nothing ever returns the key, only that one is set. */
  setProviderKey(provider: string, key: string): Promise<{ provider: string; keySet: true }>;
}

const today = () => new Date().toISOString().slice(0, 10);

const addMonths = (iso: string, months: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

const validPrices = (prices: PriceSet) =>
  Object.values(prices).every((minor) => Number.isInteger(minor) && minor > 0);

export function createMockAdminBusinessRepo(): AdminBusinessRepo {
  const fresh = () => ({
    plans: clone(adminPlansFixture),
    priceBook: clone(adminPriceBookFixture),
    comps: clone(adminCompsFixture),
    providers: clone(adminJobProvidersFixture),
  });
  let state = fresh();
  onAdminMockReset(() => {
    state = fresh();
  });

  const me = { name: adminMeFixture.name, role: adminMeFixture.role };

  const planOf = (planId: string) => {
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan) throw new BusinessRefusedError('not_found', `No plan ${planId}.`);
    return plan;
  };
  const providerOf = (provider: string) => {
    const found = state.providers.find((p) => p.provider === provider);
    if (!found) throw new BusinessRefusedError('not_found', `No provider ${provider}.`);
    return found;
  };

  const setPrices = (planId: string, prices: PriceSet) => {
    const plan = planOf(planId);
    if (plan.tier === 'free') {
      throw new BusinessRefusedError('free_plan_price', 'The Free plan has no price.');
    }
    if (!validPrices(prices)) {
      throw new BusinessRefusedError('invalid_price', 'Every price must be more than zero.');
    }
    plan.prices = { ...prices };
    return plan;
  };

  return {
    plans: () => simulate(() => clone(state.plans)),
    priceBook: () => simulate(() => clone(state.priceBook), { empty: () => [] }),
    comps: (page) =>
      simulate<CompPage | null>(
        () => {
          const pages = Math.max(1, Math.ceil(state.comps.length / COMPS_PAGE_SIZE));
          const at = Math.min(Math.max(1, page), pages);
          return {
            rows: clone(state.comps.slice((at - 1) * COMPS_PAGE_SIZE, at * COMPS_PAGE_SIZE)),
            page: at,
            pages,
            active: state.comps.length,
          };
        },
        { empty: () => ({ rows: [], page: 1, pages: 1, active: 0 }) },
      ),

    createPriceVersion: (input) =>
      simulate(() => {
        const monthly = state.plans.find((p) => p.tier === 'pro' && p.period === 'month');
        const annual = state.plans.find((p) => p.tier === 'pro' && p.period === 'year');
        if (!monthly || !annual) throw new BusinessRefusedError('not_found', 'No Pro plans.');
        setPrices(monthly.id, input.monthly);
        setPrices(annual.id, input.annual);
        for (const version of state.priceBook) version.status = 'retired';
        const next: PriceVersion = {
          version: Math.max(0, ...state.priceBook.map((v) => v.version)) + 1,
          effectiveFrom: today(),
          monthly: { ...input.monthly },
          annual: { ...input.annual },
          createdBy: me,
          status: 'active',
        };
        state.priceBook = [next, ...state.priceBook];
        recordAdminAudit('Changed plan prices', 'user', `price book v${next.version}`);
      }),

    setPlanPrices: (planId, prices) =>
      simulate(() => {
        const plan = clone(setPrices(planId, prices));
        recordAdminAudit('Changed plan prices', 'user', `plan ${planId}`);
        return plan;
      }),

    setQuotas: (planId, quotas) =>
      simulate(() => {
        const plan = planOf(planId);
        for (const quota of plan.quotas) {
          if (quota.note || !(quota.key in quotas)) continue;
          const limit = quotas[quota.key];
          if (limit !== null && limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
            throw new BusinessRefusedError(
              'invalid_quota',
              'A quota is a whole number, 0 or more.',
            );
          }
          quota.limit = limit ?? null;
        }
        plan.quotasChanged = { at: new Date().toISOString(), by: me.name };
        recordAdminAudit('Changed plan quotas', 'user', `plan ${planId}`);
        return clone(plan);
      }),

    grantComp: (input) =>
      simulate(() => {
        const ref = input.userRef.trim();
        if (
          ref.length < 4 ||
          input.months < 1 ||
          input.months > 12 ||
          input.reason.trim().length < 3
        ) {
          throw new BusinessRefusedError(
            'invalid_comp',
            'A comp needs a user, 1 to 12 months and a reason.',
          );
        }
        const start = today();
        const grant: CompGrant = {
          id: `comp_${Date.now()}`,
          userRef: ref,
          months: input.months,
          reason: input.reason.trim(),
          grantedBy: me,
          startedAt: start,
          endsAt: addMonths(start, input.months),
        };
        state.comps = [grant, ...state.comps];
        recordAdminAudit(
          'Granted comp',
          'user',
          auditRef('user', ref),
          `Pro · ${input.months} months · ${grant.reason}`,
        );
      }),

    endComp: (id) =>
      simulate(() => {
        state.comps = state.comps.filter((grant) => grant.id !== id);
        recordAdminAudit('Ended comp', 'user', auditRef('comp', id));
      }),

    analytics: (range) =>
      simulate(() => adminAnalyticsFixture(range), {
        empty: () => ({
          range,
          // Empty, not unserved: the mock serves every section, so none reads "Not connected".
          funnel: { conversion: 0, deltaPoints: null, steps: [] },
          retention: { cohorts: [], week4Average: null },
          generations: {
            rows: [],
            total: 0,
            perActiveUser: null,
            failed: null,
            failedRate: null,
            p95Seconds: null,
          },
          ats: { mean: null, deltaPoints: null, median: null, rubricVersion: null, buckets: [] },
          quota: { planLabel: 'Free plan', atCapShare: 0, deltaPoints: null, rows: [] },
          providerUsage: { rows: [], totalUsd: 0 },
        }),
      }),

    providers: () => simulate(() => clone(state.providers), { empty: () => [] }),

    setProviderEnabled: (provider, enabled) =>
      simulate(() => {
        const found = providerOf(provider);
        found.enabled = enabled;
        if (enabled) {
          found.pausedBy = null;
          // No traffic has been measured since it came back, so no health is claimed yet.
          found.health = null;
          found.errorNote = 'Back on · no traffic measured yet';
          // The pre-pause trend isn't this run's; the attribution is enforced again from now.
          found.errorTrend = [];
          if (found.attribution) found.attribution = { ...found.attribution, state: 'shown' };
        } else {
          found.health = 'paused';
          found.pausedBy = { name: me.name, at: today() };
          found.errorRate = null;
          found.errorNote = 'No traffic while paused';
          if (found.attribution) {
            found.attribution = { ...found.attribution, state: 'enforced_when_enabled' };
          }
        }
        recordAdminAudit(
          enabled ? 'Turned provider on' : 'Paused provider',
          'provider',
          `provider ${provider}`,
        );
        return clone(found);
      }),

    setProviderCeiling: (provider, dailyCalls) =>
      simulate(() => {
        if (!Number.isInteger(dailyCalls) || dailyCalls < 0) {
          throw new BusinessRefusedError(
            'invalid_ceiling',
            'A ceiling is a whole number of calls.',
          );
        }
        const found = providerOf(provider);
        found.quota.ceiling = dailyCalls;
        recordAdminAudit(
          'Changed provider settings',
          'provider',
          `provider ${provider}`,
          `Daily ceiling ${dailyCalls}`,
        );
        return clone(found);
      }),

    setProviderKey: (provider, key) =>
      simulate(() => {
        if (key.trim().length < 8) {
          throw new BusinessRefusedError('invalid_key', 'That doesn’t look like an API key.');
        }
        const found = providerOf(provider);
        // The key itself is dropped here, as the server hands it to the secrets store: nothing
        // keeps it where a read could return it.
        found.key = { set: true, addedAt: today(), addedBy: me.name };
        recordAdminAudit('Set provider key', 'provider', `provider ${provider}`);
        return { provider, keySet: true as const };
      }),
  };
}
