import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PlanId } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

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
    onSuccess: (subscription) => {
      queryClient.setQueryData(qk.user.subscription(), subscription);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.user.all }),
        queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
      ]),
  });
}
