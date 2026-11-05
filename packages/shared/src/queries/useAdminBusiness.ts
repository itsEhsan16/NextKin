import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AnalyticsRange,
  CompInput,
  PriceSet,
  PriceVersionInput,
} from '../models/adminBusiness';
import { repos } from '../repos';

/**
 * Query hooks for the admin portal's Business area: plans and the price book, product analytics,
 * job providers with write-only keys (Figma 406:2873, 407:1430, 408:3596). Keys live here
 * (`['admin', 'business', ...]`), so `qk.admin.all` still sweeps them.
 */
export const qkAdminBusiness = {
  all: ['admin', 'business'] as const,
  plans: () => ['admin', 'business', 'plans'] as const,
  priceBook: () => ['admin', 'business', 'price-book'] as const,
  comps: (page: number) => ['admin', 'business', 'comps', page] as const,
  analytics: (range: string) => ['admin', 'business', 'analytics', range] as const,
  providers: () => ['admin', 'business', 'providers'] as const,
};

export function useAdminPlans() {
  return useQuery({
    queryKey: qkAdminBusiness.plans(),
    queryFn: () => repos.adminBusiness.plans(),
  });
}

export function useAdminPriceBook() {
  return useQuery({
    queryKey: qkAdminBusiness.priceBook(),
    queryFn: () => repos.adminBusiness.priceBook(),
  });
}

export function useAdminComps(page: number) {
  return useQuery({
    queryKey: qkAdminBusiness.comps(page),
    queryFn: () => repos.adminBusiness.comps(page),
    placeholderData: keepPreviousData,
  });
}

/** Refreshes the plans, the price book and the comps after a change to any of them. */
function usePlansChanged() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: qkAdminBusiness.plans() }),
      client.invalidateQueries({ queryKey: qkAdminBusiness.priceBook() }),
      client.invalidateQueries({ queryKey: ['admin', 'business', 'comps'] }),
    ]);
}

export function useCreatePriceVersion() {
  const changed = usePlansChanged();
  return useMutation({
    mutationFn: (input: PriceVersionInput) => repos.adminBusiness.createPriceVersion(input),
    onSuccess: changed,
  });
}

export function useSetPlanPrices() {
  const changed = usePlansChanged();
  return useMutation({
    mutationFn: ({ planId, prices }: { planId: string; prices: PriceSet }) =>
      repos.adminBusiness.setPlanPrices(planId, prices),
    onSuccess: changed,
  });
}

export function useSetPlanQuotas() {
  const changed = usePlansChanged();
  return useMutation({
    mutationFn: ({ planId, quotas }: { planId: string; quotas: Record<string, number | null> }) =>
      repos.adminBusiness.setQuotas(planId, quotas),
    onSuccess: changed,
  });
}

export function useGrantComp() {
  const changed = usePlansChanged();
  return useMutation({
    mutationFn: (input: CompInput) => repos.adminBusiness.grantComp(input),
    onSuccess: changed,
  });
}

export function useEndComp() {
  const changed = usePlansChanged();
  return useMutation({
    mutationFn: (id: string) => repos.adminBusiness.endComp(id),
    onSuccess: changed,
  });
}

/** One window of the Analytics page; switching windows keeps the last one up until the next arrives. */
export function useAdminAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: qkAdminBusiness.analytics(range),
    queryFn: () => repos.adminBusiness.analytics(range),
    placeholderData: keepPreviousData,
  });
}

export function useAdminJobProviders() {
  return useQuery({
    queryKey: qkAdminBusiness.providers(),
    queryFn: () => repos.adminBusiness.providers(),
  });
}

function useProvidersChanged() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: qkAdminBusiness.providers() });
}

export function useSetProviderEnabled() {
  const changed = useProvidersChanged();
  return useMutation({
    mutationFn: ({ provider, enabled }: { provider: string; enabled: boolean }) =>
      repos.adminBusiness.setProviderEnabled(provider, enabled),
    onSuccess: changed,
  });
}

export function useSetProviderCeiling() {
  const changed = useProvidersChanged();
  return useMutation({
    mutationFn: ({ provider, dailyCalls }: { provider: string; dailyCalls: number }) =>
      repos.adminBusiness.setProviderCeiling(provider, dailyCalls),
    onSuccess: changed,
  });
}

/** Sends a key to be stored; nothing returns it, so there's nothing to cache. */
export function useSetProviderKey() {
  const changed = useProvidersChanged();
  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      repos.adminBusiness.setProviderKey(provider, key),
    onSuccess: changed,
  });
}
