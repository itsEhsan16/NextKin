import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { AtsCheckItem, EditableSectionKey, Resume } from '@/data/models';
import type { UpgradeReason } from '@/features/billing';
import { useOptionalCreateSheet } from '@/navigation';

import { useResumesStore, type ResumeSurface } from '../resumesStore';

const noop = () => {};

/** Every tap target on the Resumes screens resolves here, keeping routing out of components. */
export function useResumesActions() {
  const router = useRouter();
  // The "+ New" tile is the same affordance as the FAB, so it opens the same create sheet. The
  // editor, score, rubric, fix and new screens sit above the tabs' provider and never show it.
  const openCreateSheet = useOptionalCreateSheet()?.open ?? noop;
  const openMenuFor = useResumesStore((state) => state.openMenu);
  const openExportFor = useResumesStore((state) => state.openExport);
  const openSortSheet = useResumesStore((state) => state.openSort);

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      /** The sort sheet is hosted over the tab bar (ResumeSortSheetHost), not pushed. */
      openSort: openSortSheet,
      /** V2 §7.16 context awareness: the assistant opens knowing which document is meant. */
      askAboutScore: (resumeId: string) =>
        router.push({ pathname: '/assistant', params: { resumeId } }),
      /** §13.5: a gated control names the limit it hit rather than opening a generic pitch. */
      openUpgrade: (reason?: UpgradeReason) =>
        router.push(reason ? { pathname: '/upgrade', params: { reason } } : '/upgrade'),
      openCreate: openCreateSheet,
      openScore: (resume: Resume) =>
        router.push({ pathname: '/resumes/[id]/score', params: { id: resume.id } }),
      // V2 §7.8: every score display links to the published rubric, so this is by id — a badge,
      // a card or the score panel can all reach it with what they already hold.
      openScoreRubric: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]/rubric', params: { id: resumeId } }),
      /**
       * Both document kinds open the same editor (V2 §7.11): the score panel is a view *of* a
       * document, not the document, and an unscored draft has no panel at all — so the library,
       * Home and the generation result all land here and reach the score from the editor's
       * own meta strip.
       */
      openDocument: (resume: Resume) =>
        router.push({ pathname: '/resumes/[id]', params: { id: resume.id } }),
      /** The same destination for callers that only hold an id (a deep link, a finished run). */
      openEditor: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]', params: { id: resumeId } }),
      /** One section of the body, edited on its own page (V2 §7.11; §7.10 for 'letter'). */
      openSection: (resumeId: string, section: EditableSectionKey) =>
        router.push({
          pathname: '/resumes/[id]/edit/[section]',
          params: { id: resumeId, section },
        }),
      openMenu: (resume: Resume, surface?: ResumeSurface) => openMenuFor(resume, surface),
      // First-run CTAs (RESUMES 05).
      uploadResume: () => router.push('/create/upload'),
      importLinkedIn: () => router.push('/create/import-linkedin'),
      startWithAi: () => router.push('/resumes/new'),
      /** Carries the document through, so the intake screen starts from this resume. */
      tailorResume: (resume: Resume) =>
        router.push({ pathname: '/create/tailor', params: { resumeId: resume.id } }),
      /**
       * A sheet, not a screen: the format choice is three rows and the file has to be handed to
       * the OS share sheet from the surface that asked for it (V2 §7.12).
       */
      downloadResume: (resume: Resume, surface?: ResumeSurface) => openExportFor(resume, surface),
      /**
       * The quick-win list (V2 §7.8). An item id rides along when the reader tapped one specific
       * check, so the fix screen can open with that card in view rather than at the top.
       */
      fixWithAi: (resumeId: string, item?: AtsCheckItem) =>
        router.push({
          pathname: '/resumes/[id]/fix',
          params: item ? { id: resumeId, item: item.id } : { id: resumeId },
        }),
      goBack: () => router.back(),
    }),
    [openCreateSheet, openExportFor, openMenuFor, openSortSheet, router],
  );
}
