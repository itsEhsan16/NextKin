import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { JdDraft, JdDraftPatch, JdInput } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

/**
 * Reads a pasted, uploaded or job-board JD into editable fields (V2 §7.5). Write-through: the
 * intake screen navigates straight to the review screen for the draft that comes back, so its
 * detail cache is seeded rather than refetched behind the transition.
 */
export function useExtractJd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: JdInput) => repos.jd.extract(input),
    onSuccess: (draft) => {
      queryClient.setQueryData(qk.jd.detail(draft.id), draft);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jd.all }),
  });
}

/** Re-opens a saved extraction: the review screen and a generation both read it (V2 §7.5). */
export function useJdDraft(id: string) {
  return useQuery({
    queryKey: qk.jd.detail(id),
    queryFn: () => repos.jd.get(id),
    enabled: id.length > 0,
  });
}

/**
 * Saves the review screen's edits (V2 §7.5). Optimistic, because the screen moves a skill chip
 * between the required and preferred groups: the chip has to land in the other group under the
 * finger, not after the extraction latency, or the tap reads as dropped.
 */
export function useUpdateJdDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: JdDraftPatch) => repos.jd.update(id, patch),
    onMutate: async (patch) => {
      // First: an in-flight refetch that resolves after the write below would land the
      // pre-edit draft on top of it and snap the chip back.
      await queryClient.cancelQueries({ queryKey: qk.jd.detail(id) });
      const previous = queryClient.getQueryData<JdDraft>(qk.jd.detail(id));
      queryClient.setQueryData<JdDraft>(qk.jd.detail(id), (old) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(qk.jd.detail(id), context.previous);
    },
    onSuccess: (draft) => {
      queryClient.setQueryData(qk.jd.detail(id), draft);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jd.all }),
  });
}
