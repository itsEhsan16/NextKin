import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DocumentContent, ResumeContent, ResumeSectionKey } from '@/data/models';
import { type CoverLetterPatch, repos } from '@/data/repos';

import { qk } from './keys';

/**
 * NextKin V2 spec §7.11 (the structured section editor and its append-only history), §7.10 (the
 * cover-letter body) and §7.8 (the quick-win fixes) — the document body, which is a cache of its
 * own: `qk.resumes.detail` holds the metadata that describes the document, this holds the document.
 */

/**
 * One section write, correlated: `value` is typed to the `section` standing beside it, so no
 * caller can hand `skills` a list of roles. Mirrors the repo's generic `updateSection`.
 */
export type ResumeSectionEdit = {
  [K in ResumeSectionKey]: { section: K; value: ResumeContent[K] };
}[ResumeSectionKey];

/**
 * What a single body edit moves — all five, every time. The repo re-scores the document
 * (`score`) and mints a version rather than rewriting the head (`versions`), which bumps
 * `currentVersionId` and `updatedAt` on the metadata (`detail`); the library card renders both
 * the score and the edited-at line, so the list is stale too (`list`) — on top of the body the
 * editor just wrote (`content`).
 */
function invalidateEdit(queryClient: QueryClient, id: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.resumes.content(id) }),
    queryClient.invalidateQueries({ queryKey: qk.resumes.score(id) }),
    queryClient.invalidateQueries({ queryKey: qk.resumes.detail(id) }),
    queryClient.invalidateQueries({ queryKey: qk.resumes.versions(id) }),
    queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  ]);
}

/** The structured body the editor edits — never a rendered file (V2 §7.11). */
export function useResumeContent(id: string) {
  return useQuery({
    queryKey: qk.resumes.content(id),
    queryFn: () => repos.resumes.getContent(id),
    enabled: id.length > 0,
  });
}

/**
 * A section save. Optimistic: the editor pops back to the document the moment Save is tapped, so
 * the page behind it has to already read the new text — a round trip would show the old copy for
 * a beat and then swap it under the reader.
 */
export function useUpdateResumeSection(id: string) {
  const queryClient = useQueryClient();
  const queryKey = qk.resumes.content(id);
  return useMutation({
    mutationFn: (edit: ResumeSectionEdit) =>
      repos.resumes.updateSection(id, edit.section, edit.value),
    onMutate: async (edit) => {
      // Cancel first: an in-flight read of the body would otherwise land after this write.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DocumentContent>(queryKey);
      queryClient.setQueryData<DocumentContent>(queryKey, (old) =>
        // A letter has no §7.11 sections — `useUpdateLetter` writes that half, and the repo
        // rejects this route for one, so the guess must not invent a field on a letter either.
        // The cast is TS's computed-key limit, not a widening: `value` is already section-typed.
        old && old.kind === 'resume'
          ? ({ ...old, [edit.section]: edit.value } as ResumeContent)
          : old,
      );
      return { previous };
    },
    onError: (_error, _edit, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (content) => {
      // The server's copy carries the version the write minted and the cleared review flags.
      queryClient.setQueryData(queryKey, content);
    },
    onSettled: () => invalidateEdit(queryClient, id),
  });
}

/**
 * A cover-letter body save (V2 §7.10). Optimistic for the same reason as a section: the letter
 * editor closes on save and the document behind it must already read the new paragraphs.
 */
export function useUpdateLetter(id: string) {
  const queryClient = useQueryClient();
  const queryKey = qk.resumes.content(id);
  return useMutation({
    mutationFn: (patch: CoverLetterPatch) => repos.resumes.updateLetter(id, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DocumentContent>(queryKey);
      queryClient.setQueryData<DocumentContent>(queryKey, (old) =>
        // The mirror of the guard above: a resume has no greeting to patch.
        old && old.kind === 'cover_letter' ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (content) => {
      queryClient.setQueryData(queryKey, content);
    },
    onSettled: () => invalidateEdit(queryClient, id),
  });
}

/**
 * Re-runs the model over one section (V2 §7.11). Deliberately NOT optimistic: the AI's output is
 * the truth and there is nothing sensible to guess, so the section holds its shimmer until the
 * new copy lands rather than showing a fabricated one.
 */
export function useRegenerateSection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (section: ResumeSectionKey) => repos.resumes.regenerateSection(id, section),
    onSuccess: (content) => {
      queryClient.setQueryData(qk.resumes.content(id), content);
    },
    onSettled: () => invalidateEdit(queryClient, id),
  });
}

/**
 * One quick win from the score panel (V2 §7.8). The repo patches the document and re-scores in a
 * single write and hands both back, so both caches are written from that pair: the fix screen
 * ticks the item and the ring moves together, instead of the ring lagging a refetch behind.
 */
export function useApplyAtsFix(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => repos.resumes.applyAtsFix(id, itemId),
    onSuccess: ({ content, score }) => {
      queryClient.setQueryData(qk.resumes.content(id), content);
      queryClient.setQueryData(qk.resumes.score(id), score);
    },
    onSettled: () => invalidateEdit(queryClient, id),
  });
}
