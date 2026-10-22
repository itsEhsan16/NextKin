import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Billing, BillingSettings, PlanId, Subscription } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { refetchWhenQueueEmpty, writeQueue } from './writeQueue';

const BILLING_QUEUE = 'billing-settings';

/**
 * The purchasable SKUs behind the plan screen (V2 §13.2). The comparison table itself is static
 * copy (`PLAN_FEATURES` in @/data/models), so only the prices come over the wire.
 */
export function usePlans() {
  return useQuery({
    queryKey: qk.user.plans(),
    queryFn: () => repos.user.listPlans(),
  });
}

/**
 * Moves the subscription onto a plan (V2 §13). Write-through rather than optimistic: the screen
 * stays on the plan card behind a pending button while the purchase resolves, and entitlements
 * are the server's answer to guess at — the usage meters would be wrong for the whole latency.
 *
 * The upgrade also writes an activity entry and posts a welcome notification, so it settles the
 * whole user aggregate (subscription, plans, activity) and the notification feed.
 */
export function useUpgradePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: PlanId) => repos.user.upgrade(planId),
    // The mock upgrades at once; the backend hands back a checkout for the caller to open (P12-06).
    onSuccess: (result) => {
      if (result.kind === 'done') queryClient.setQueryData(qk.user.subscription(), result.subscription);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.user.all }),
        queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
      ]),
  });
}

/**
 * The subscriber's own changes (P12-10): cancel in one step, pause, resume, the 14-day withdrawal.
 * Each settles the whole user aggregate: on the backend the plan follows by webhook, so the meters
 * are read again rather than guessed.
 */
function useSubscriptionChange<T>(run: (input: T) => Promise<Subscription>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (subscription) => queryClient.setQueryData(qk.user.subscription(), subscription),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.user.all }),
  });
}
export const useCancelSubscription = () => useSubscriptionChange<void>(() => repos.user.cancelSubscription());
export const usePauseSubscription = () => useSubscriptionChange<1 | 2 | 3>((months) => repos.user.pauseSubscription(months));
export const useResumeSubscription = () => useSubscriptionChange<void>(() => repos.user.resumeSubscription());
export const useWithdrawSubscription = () => useSubscriptionChange<void>(() => repos.user.withdrawSubscription());

/** The card on file, renewal and invoices (web Settings → Billing & plan, Figma 470:3). */
export function useBilling() {
  return useQuery({
    queryKey: qk.user.billing(),
    queryFn: () => repos.user.getBilling(),
  });
}

/**
 * Auto-renewal and the billing cycle, one change at a time and optimistic, as the privacy
 * switches are (`useUpdatePrivacySettings`): queued, so quick changes land in order, and a failed
 * write puts the settings back as they were.
 */
export function useUpdateBillingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<BillingSettings>) => repos.user.updateBillingSettings(patch),
    ...writeQueue(BILLING_QUEUE),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.user.billing() });
      const previous = queryClient.getQueryData<Billing>(qk.user.billing());
      queryClient.setQueryData<Billing>(qk.user.billing(), (old) =>
        old ? { ...old, settings: { ...old.settings, ...patch } } : old,
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(qk.user.billing(), context.previous);
    },
    onSettled: () => refetchWhenQueueEmpty(queryClient, BILLING_QUEUE, qk.user.billing()),
  });
}
