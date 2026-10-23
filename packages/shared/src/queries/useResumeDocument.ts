import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { ResumeDocumentWrite, ResumeTemplateId } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * The resume editor's document (toreview §124). Read once when the editor opens: the editor holds
 * the working copy itself, so a background refetch never replaces what the user is typing.
 */
export function useResumeDocument(id: string) {
  return useQuery({
    queryKey: qk.resumes.document(id),
    queryFn: () => repos.resumes.getDocument(id),
    enabled: id.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * One save of the whole document, from the revision it was edited from. The server's copy comes
 * back with the new revision; everything the library shows of the resume moves with it.
 */
export function useSaveResumeDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ write, baseRevision }: { write: ResumeDocumentWrite; baseRevision: string }) =>
      repos.resumes.saveDocument(id, write, baseRevision),
    onSuccess: (document) => {
      queryClient.setQueryData(qk.resumes.document(id), document);
      void queryClient.invalidateQueries({ queryKey: qk.resumes.content(id) });
      void queryClient.invalidateQueries({ queryKey: qk.resumes.detail(id) });
      void queryClient.invalidateQueries({ queryKey: qk.resumes.versions(id) });
      void queryClient.invalidateQueries({ queryKey: qk.resumes.score(id) });
      void queryClient.invalidateQueries({ queryKey: ['resumes', 'preview', id] });
      void queryClient.invalidateQueries({ queryKey: qk.resumes.list() });
    },
  });
}

/** Reads the newest copy past the cache: the editor's way out of a conflict. */
export function useFetchLatestResumeDocument(id: string) {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const latest = await repos.resumes.getDocument(id);
    queryClient.setQueryData(qk.resumes.document(id), latest);
    return latest;
  }, [id, queryClient]);
}

/**
 * Sets a resume's template as one ordinary document save (toreview §126, RES 02's Template): the
 * build-from-profile run writes Classic, and a choice of Modern or Elegant is applied the moment it
 * lands, before the editor opens.
 */
export function useSetResumeTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, template }: { id: string; template: ResumeTemplateId }) => {
      const doc = await repos.resumes.getDocument(id);
      const { header, summary, skills, experience, projects, education, certifications, custom, order, headings } = doc;
      const write: ResumeDocumentWrite = { header, summary, skills, experience, projects, education, certifications, custom, order, headings, template };
      return repos.resumes.saveDocument(id, write, doc.revision);
    },
    onSuccess: (document, { id }) => {
      queryClient.setQueryData(qk.resumes.document(id), document);
      void queryClient.invalidateQueries({ queryKey: qk.resumes.detail(id) });
    },
  });
}
