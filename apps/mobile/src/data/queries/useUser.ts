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
