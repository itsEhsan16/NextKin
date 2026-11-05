import type { AdminAnalyticsPage, PriceSet } from '../../models/adminBusiness';
import { BusinessRefusedError, type AdminBusinessRepo } from '../adminBusinessRepo';
import { NotFoundError } from '../state';
import {
  planStatsSchema,
  providerStatsSchema,
  toAnalyticsReport,
  toComps,
  toPriceBook,
} from './adminBusinessReport';
import {
  planRank,
  plansSchema,
  providersSchema,
  QUOTA_KEYS,
  retentionSchema,
  toPlan,
  toProvider,
} from './adminBusinessWire';
import type { HttpClient } from './client';

/**
 * `AdminBusinessRepo` over `/api/v1/admin/*` (`routes/admin.ts`; `services/admin/catalog.ts`,
 * `users.ts`, `retention.ts`). Every method answers from the server: one the server doesn't serve
 * yet returns its "not served" shape (`null`) or refuses with `UNAVAILABLE`, never fixture data, so
 * no sample record reaches a real staff session (`toreview.md` §171.7). The wire shapes and their
 * mapping are in `adminBusinessWire.ts`.
 *
 * Served: plans with their prices, quotas, member counts and last quota change; the price book and
 * a new version of it (both Pro plans at once); granting, listing and ending a comp; the Analytics
 * report for a window and week-4 retention; providers with today's traffic, errors, key and pause,
 * and their edits. Not served: a plan's member change over the month and why provider calls fail,
 * which nothing records.
 *
 * Writes check what the server's request schemas check before anything is sent, so a refusal
 * carries the `BusinessRefusedError` code the mock gives and nothing half-valid reaches the API.
 */

/** A user id as the API takes it (`users.inspectUser` checks the same). */
const USER_ID = /^[0-9a-f-]{36}$/i;

/** The three currencies the price route takes, each a whole number of minor units above 0. */
function priceSet(prices: PriceSet): PriceSet {
  const set = { USD: prices.USD, EUR: prices.EUR, AUD: prices.AUD };
  if (!Object.values(set).every((minor) => Number.isInteger(minor) && minor > 0)) {
    throw new BusinessRefusedError('invalid_price', 'Every price must be more than zero.');
  }
  return set;
}

export function createHttpAdminBusinessRepo(http: HttpClient): AdminBusinessRepo {
  /** A stats read the server doesn't serve (an older API) leaves those figures unserved. */
  const unlessMissing = <T>(request: Promise<T>): Promise<T | null> =>
    request.catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
  const plans = async () => {
    const [raw, stats] = await Promise.all([
      http.request('/admin/plans'),
      unlessMissing(http.request('/admin/plans/stats').then((v) => planStatsSchema.parse(v))),
    ]);
    return plansSchema
      .parse(raw)
      .data.map((row) => toPlan(row, stats))
      .sort((a, b) => planRank(a) - planRank(b));
  };
  const providers = async () => {
    const [raw, stats] = await Promise.all([
      http.request('/admin/providers'),
      unlessMissing(
        http.request('/admin/providers/stats').then((v) => providerStatsSchema.parse(v)),
      ),
    ]);
    return providersSchema.parse(raw).data.map((row) => toProvider(row, stats));
  };
  const providerOf = async (provider: string) => {
    const found = (await providers()).find((p) => p.provider === provider);
    if (!found) throw new BusinessRefusedError('not_found', `No provider ${provider}.`);
    return found;
  };
  const planOf = async (planId: string) => {
    const found = (await plans()).find((p) => p.id === planId);
    if (!found) throw new BusinessRefusedError('not_found', `No plan ${planId}.`);
    return found;
  };
  /** One price-book version: both Pro plans in one transaction (`business.createPriceVersion`). */
  const postVersion = (monthly: PriceSet, annual: PriceSet) =>
    http.request('/admin/price-book', { method: 'POST', body: { monthly, annual } });
  const patchProvider = (provider: string, body: { enabled: boolean } | { dailyCalls: number }) =>
    http.request(`/admin/providers/${encodeURIComponent(provider)}`, { method: 'PATCH', body });

  return {
    plans,
    priceBook: async () => toPriceBook(await http.request('/admin/price-book')),
    comps: async (page) => toComps(await http.request('/admin/comps', { query: { page } })),

    createPriceVersion: async (input) => {
      await postVersion(priceSet(input.monthly), priceSet(input.annual));
    },

    // One plan's new prices are a new version with the other Pro plan's prices as they stand.
    setPlanPrices: async (planId, prices) => {
      const set = priceSet(prices);
      const all = await plans();
      const plan = all.find((p) => p.id === planId);
      if (!plan) throw new BusinessRefusedError('not_found', `No plan ${planId}.`);
      if (plan.tier === 'free') {
        throw new BusinessRefusedError('free_plan_price', 'The Free plan has no price.');
      }
      const monthly = all.find((p) => p.tier === 'pro' && p.period === 'month');
      const annual = all.find((p) => p.tier === 'pro' && p.period === 'year');
      if (!monthly || !annual) throw new BusinessRefusedError('not_found', 'No Pro plans.');
      await postVersion(
        plan.id === monthly.id ? set : monthly.prices,
        plan.id === annual.id ? set : annual.prices,
      );
      return planOf(planId);
    },

    setQuotas: async (planId, quotas) => {
      // Keys the plan doesn't list are ignored, as on the mock; the route refuses unknown ones.
      const body = Object.fromEntries(
        Object.entries(quotas).filter(([key]) => QUOTA_KEYS.has(key)),
      );
      if (
        Object.values(body).some(
          (limit) => limit !== null && (!Number.isInteger(limit) || limit < 0),
        )
      ) {
        throw new BusinessRefusedError('invalid_quota', 'A quota is a whole number, 0 or more.');
      }
      // Nothing to save: the route would still write a "Changed plan quotas" audit row.
      if (Object.keys(body).length === 0) return planOf(planId);
      await http.request(`/admin/plans/${encodeURIComponent(planId)}/quotas`, {
        method: 'PATCH',
        body,
      });
      return planOf(planId);
    },

    grantComp: async (input) => {
      const userId = input.userRef.trim();
      const reason = input.reason.trim();
      const { months } = input;
      if (!Number.isInteger(months) || months < 1 || months > 12 || reason.length < 3) {
        throw new BusinessRefusedError(
          'invalid_comp',
          'A comp needs a user, 1 to 12 months and a reason.',
        );
      }
      if (reason.length > 500) {
        throw new BusinessRefusedError('invalid_comp', 'Keep the reason to 500 characters.');
      }
      // The API takes the full id; the last four characters tables show aren't enough.
      if (!USER_ID.test(userId)) {
        throw new BusinessRefusedError('invalid_comp', 'Enter the user’s full ID from their page.');
      }
      await http.request(`/admin/users/${encodeURIComponent(userId)}/comp`, {
        method: 'POST',
        body: { months, reason },
      });
    },

    endComp: async (id) => {
      await http.request(`/admin/comps/${encodeURIComponent(id)}/end`, { method: 'POST' });
    },

    analytics: async (range): Promise<AdminAnalyticsPage> => {
      const [raw, retention] = await Promise.all([
        http.request('/admin/analytics/report', { query: { range } }),
        http
          .request('/admin/metrics/retention')
          .then((value) => retentionSchema.parse(value).data)
          // A server without the route doesn't serve retention; any other failure is the page's.
          .catch((error: unknown) => {
            if (error instanceof NotFoundError) return null;
            throw error;
          }),
      ]);
      return toAnalyticsReport(raw, retention);
    },

    providers,

    setProviderEnabled: async (provider, enabled) => {
      await patchProvider(provider, { enabled });
      return providerOf(provider);
    },

    setProviderCeiling: async (provider, dailyCalls) => {
      if (!Number.isInteger(dailyCalls) || dailyCalls < 0) {
        throw new BusinessRefusedError('invalid_ceiling', 'A ceiling is a whole number of calls.');
      }
      await patchProvider(provider, { dailyCalls });
      return providerOf(provider);
    },

    setProviderKey: async (provider, key) => {
      const value = key.trim();
      if (value.length < 8 || value.length > 500) {
        throw new BusinessRefusedError('invalid_key', 'That doesn’t look like an API key.');
      }
      await http.request(`/admin/providers/${encodeURIComponent(provider)}/key`, {
        method: 'PUT',
        body: { key: value },
      });
      return { provider, keySet: true as const };
    },
  };
}
