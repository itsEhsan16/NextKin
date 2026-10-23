import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { JdFile, Resume } from '@/data/models';
import { type ExportFormat, repos } from '@/data/repos';

import { qk } from './keys';

/**
 * NextKin V2 spec §7.12 (export and share) and §7.4 (importing an existing resume) — the hooks
 * that move a document out of the app or into it.
 */

/**
 * Renders a document to PDF / DOCX / TXT and hands back the RENDER INPUTS, not a file. Writing,
 * printing or sharing it is the screen's job through `@/lib/exportFile`: the data layer must not
 * touch a native module, and the real API will return a presigned URL through this same shape.
 *
 * §13.3 keeps PDF clean and unpaywalled on every plan; DOCX is the gated format and the repo
 * throws `PlanLockedError` if a locked control is reached, which the screen renders as the
 * upgrade sheet rather than an error state.
 *
 * An export is an entry in §7.2's audit trail, and logging one bumps the dashboard counter derived
 * from that trail as well — so BOTH the activity list and Home's "Activities" tile are stale after
 * an export. On success only, because a failed or plan-locked export logs nothing and moves
 * neither cache.
 */
export function useExportResume(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (format: ExportFormat) => repos.resumes.export(id, format),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.user.activity() }),
        queryClient.invalidateQueries({ queryKey: qk.user.dashboardStats() }),
      ]),
  });
}

/**
 * A view-only link to the current version (V2 §7.12). Nothing is cached and nothing invalidates:
 * the URL goes straight to the share sheet, and the document it points at has not changed.
 */
export function useShareLink(id: string) {
  return useMutation({
    mutationFn: () => repos.resumes.shareLink(id),
  });
}

/**
 * Parses an uploaded resume into a document plus a profile draft (V2 §7.4). The document is real
 * and lands in the library at once, so the list is written through the way a duplicate is.
 *
 * The returned `ProfileDraft` is deliberately NOT applied. §7.4 is explicit that a parse yields a
 * draft and nothing touches the profile until the user accepts rows on the review screen (Phase
 * 9D) — abandoning that screen has to leave the profile exactly as it was.
 */
export function useImportResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: JdFile) => repos.resumes.importFromFile(file),
    onSuccess: ({ resume }) => {
      queryClient.setQueryData(qk.resumes.detail(resume.id), resume);
      queryClient.setQueryData<Resume[]>(qk.resumes.list(), (old) =>
        old ? [resume, ...old] : old,
      );
      // Forward-looking, not yet load-bearing: §7.2 wants an "imported" entry in the audit trail,
      // but `importFromFile` does not call the repo's `logActivity` (it writes the resume, its
      // first version and its body, and stops). Until that repo change lands this refetch returns
      // the same list — and no `dashboardStats` invalidation belongs here, because the mock does
      // not bump the counter either.
      return queryClient.invalidateQueries({ queryKey: qk.user.activity() });
    },
    // An import can also move the "Base" flag onto the first document an empty library gets.
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
  });
}
