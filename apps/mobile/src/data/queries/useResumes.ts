import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Resume } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

export function useResumes() {
  return useQuery({
    queryKey: qk.resumes.list(),
    queryFn: () => repos.resumes.list(),
  });
}

export function useResume(id: string) {
  return useQuery({
    queryKey: qk.resumes.detail(id),
    queryFn: () => repos.resumes.get(id),
    enabled: id.length > 0,
  });
}

export function useResumeScore(id: string) {
  return useQuery({
    queryKey: qk.resumes.score(id),
    queryFn: () => repos.resumes.getScore(id),
    enabled: id.length > 0,
  });
}

export function useResumeVersions(id: string) {
  return useQuery({
    queryKey: qk.resumes.versions(id),
    queryFn: () => repos.resumes.getVersions(id),
    enabled: id.length > 0,
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.resumes.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.resumes.list() });
      const previous = queryClient.getQueryData<Resume[]>(qk.resumes.list());
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) =>
        old?.filter((resume) => resume.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(qk.resumes.list(), context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: qk.resumes.detail(id) });
      queryClient.removeQueries({ queryKey: qk.resumes.score(id) });
      queryClient.removeQueries({ queryKey: qk.resumes.versions(id) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  });
}

export function useDuplicateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.resumes.duplicate(id),
    onSuccess: (copy) => {
      queryClient.setQueryData(qk.resumes.detail(copy.id), copy);
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) => (old ? [copy, ...old] : old));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  });
}

export function useRenameResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => repos.resumes.rename(id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.resumes.detail(updated.id), updated);
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) =>
        old?.map((resume) => (resume.id === updated.id ? updated : resume)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  });
}
