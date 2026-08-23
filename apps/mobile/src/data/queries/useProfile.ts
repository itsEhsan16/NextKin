import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { repos } from '@/data/repos';

import { qk } from './keys';

export function useProfile() {
  return useQuery({
    queryKey: qk.profile.me(),
    queryFn: () => repos.profile.getProfile(),
  });
}

export function useCompleteNextStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.profile.completeNextStep(id),
    onSuccess: (profile) => {
      queryClient.setQueryData(qk.profile.me(), profile);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.profile.all }),
  });
}
