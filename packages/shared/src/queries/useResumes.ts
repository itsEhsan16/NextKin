import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sortResumes, type Resume, type ResumeDocType, type ResumeSort } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * The library. The sort is applied with `select` over the ONE cached list rather than baked into
 * the key: a key of `['resumes','list',sort]` would fork the cache that eight invalidations and six
 * optimistic writers address, and every one of them would then write only the default order. One
 * fetch, one cache, and TanStack memoises the selection per observer. `RESUME_SORT_COMPARATORS`
 * lives beside the model so the repo's `list()` can adopt them verbatim when paging arrives.
 */
export function useResumes(sort: ResumeSort = 'edited') {
  return useQuery({
    queryKey: qk.resumes.list(),
    queryFn: () => repos.resumes.list(),
    select: (resumes) => sortResumes(resumes, sort),
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

/** Fetched fresh each time: it answers for the version on screen, which an edit moves on. */
export function useLineSources(id: string) {
  return useQuery({
    queryKey: qk.resumes.sources(id),
    queryFn: () => repos.resumes.getLineSources(id),
    enabled: id.length > 0,
    staleTime: 0,
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

export function useSetResumeAsBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.resumes.setAsBase(id),
    // The repo returns the whole list because two documents change (the flag moves).
    onSuccess: (resumes) => {
      queryClient.setQueryData(qk.resumes.list(), resumes);
      resumes.forEach((resume) => queryClient.setQueryData(qk.resumes.detail(resume.id), resume));
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

/** Starts an empty document the editor fills in by hand (V2 §7.11). */
export function useCreateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; docType: ResumeDocType }) => repos.resumes.create(input),
    onSuccess: (resume) => {
      queryClient.setQueryData(qk.resumes.detail(resume.id), resume);
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) =>
        old ? [resume, ...old] : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  });
}

/**
 * Rolls the document back to an earlier version (V2 §7.11). History is never rewritten: the
 * restore lands as a new version on top, so `versions` grew, `detail` points at a new current
 * version, `content` is re-stamped with that new version id, and the library card's edited-at line
 * moved.
 *
 * The body itself does not change yet: the mock does not snapshot a body per version, so
 * `restoreVersion` only re-stamps the current one. The invalidation is still load-bearing (the
 * version id moved), and it is what will carry the older body once the store keeps per-version
 * snapshots.
 */
export function useRestoreVersion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => repos.resumes.restoreVersion(id, versionId),
    onSuccess: (restored) => {
      queryClient.setQueryData(qk.resumes.detail(restored.id), restored);
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) =>
        old?.map((resume) => (resume.id === restored.id ? restored : resume)),
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.resumes.detail(id) }),
        queryClient.invalidateQueries({ queryKey: qk.resumes.versions(id) }),
        queryClient.invalidateQueries({ queryKey: qk.resumes.content(id) }),
        queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
      ]),
  });
}
