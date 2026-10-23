import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { InterviewMark, InterviewSet } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

/**
 * NextKin V2 spec §7.15 — practice sets and the marks the reader leaves on them.
 *
 * Creating a set is `useStartGeneration({ kind: 'interview' })`: the run is an async job like
 * every other AI job, and its completion writes the set. What lives here is reading sets back,
 * finding the one a finished run produced, and the marks — which are persisted because the
 * spec's acceptance criterion is that they survive the session.
 */

export function useInterviewSets() {
  return useQuery({
    queryKey: qk.interview.list(),
    queryFn: () => repos.interview.list(),
  });
}

export function useInterviewSet(id: string) {
  return useQuery({
    queryKey: qk.interview.detail(id),
    queryFn: () => repos.interview.get(id),
    enabled: id.length > 0,
  });
}

/**
 * The set a finished run produced, for the progress screen's "Start practising" button. Null
 * while the run is in flight, and a set that has since been deleted resolves null too — the
 * screen falls back to the library rather than a dead link.
 */
export function useInterviewSetForGeneration(generationId: string) {
  return useQuery({
    queryKey: qk.interview.byGeneration(generationId),
    queryFn: () => repos.interview.getByGeneration(generationId),
    enabled: generationId.length > 0,
  });
}

/**
 * A practice mark. Optimistic on the set, because the control has to flip under the finger —
 * but deliberately with NO `onSuccess` write-back of the server's copy: at 300–900ms simulated
 * latency three quick taps race, and writing a stale whole-set response would clobber a newer
 * mark. The repo patches one question; the settle reconciles.
 *
 * The list invalidation is load-bearing: the card on `/interview` draws "6 confident · 2 need
 * work" from the same marks.
 */
export function useMarkInterviewQuestion(setId: string) {
  const queryClient = useQueryClient();
  const queryKey = qk.interview.detail(setId);
  return useMutation({
    mutationFn: ({ questionId, mark }: { questionId: string; mark: InterviewMark }) =>
      repos.interview.markQuestion(setId, questionId, mark),
    onMutate: async ({ questionId, mark }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InterviewSet>(queryKey);
      queryClient.setQueryData<InterviewSet>(queryKey, (old) =>
        old
          ? {
              ...old,
              questions: old.questions.map((question) =>
                question.id === questionId ? { ...question, mark } : question,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: qk.interview.list() }),
      ]),
  });
}

export function useResetInterviewMarks(setId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.interview.resetMarks(setId),
    onSuccess: (set) => {
      queryClient.setQueryData(qk.interview.detail(setId), set);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.interview.all }),
  });
}

export function useRemoveInterviewSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.interview.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.interview.list() });
      const previous = queryClient.getQueryData<InterviewSet[]>(qk.interview.list());
      queryClient.setQueryData<InterviewSet[]>(qk.interview.list(), (old) =>
        old?.filter((set) => set.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(qk.interview.list(), context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: qk.interview.detail(id) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.interview.list() }),
  });
}
