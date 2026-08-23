import { useQuery } from '@tanstack/react-query';

import { repos } from '@/data/repos';

import { qk } from './keys';

export function useCurrentUser() {
  return useQuery({
    queryKey: qk.user.me(),
    queryFn: () => repos.user.getCurrentUser(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: qk.user.subscription(),
    queryFn: () => repos.user.getSubscription(),
  });
}

/** V2 §7.2 dashboard counters for the Home shortcut grid. */
export function useDashboardStats() {
  return useQuery({
    queryKey: qk.user.dashboardStats(),
    queryFn: () => repos.user.getDashboardStats(),
  });
}
