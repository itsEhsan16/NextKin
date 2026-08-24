import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Resume } from '@/data/models';
import type { PlaceholderKey } from '@/features/placeholders';
import { useCreateSheet } from '@/navigation';

import { useResumesStore } from '../resumesStore';

/** Every tap target on the Resumes screens resolves here, keeping routing out of components. */
export function useResumesActions() {
  const router = useRouter();
  // The "+ New" tile is the same affordance as the FAB, so it opens the same create sheet.
  const { open: openCreateSheet } = useCreateSheet();
  const openMenuFor = useResumesStore((state) => state.openMenu);

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      openSort: () => placeholder('resume-sort'),
      openUpgrade: () => placeholder('upgrade'),
      openCreate: openCreateSheet,
      openScore: (resume: Resume) =>
        router.push({ pathname: '/resumes/[id]/score', params: { id: resume.id } }),
      // The editor is undesigned; the score panel is the only designed per-document screen,
      // so a scored document opens it and the rest land on the editor placeholder.
      openDocument: (resume: Resume) => {
        if (resume.atsScore != null) {
          router.push({ pathname: '/resumes/[id]/score', params: { id: resume.id } });
        } else {
          placeholder('resume-detail');
        }
      },
      openMenu: (resume: Resume) => openMenuFor(resume),
      // First-run CTAs (RESUMES 05) — none of these flows is designed yet (plan §8).
      uploadResume: () => placeholder('upload-resume'),
      importLinkedIn: () => placeholder('import-linkedin'),
      startWithAi: () => placeholder('start-from-scratch'),
      // Menu rows without designed destinations.
      renameResume: () => placeholder('resume-rename'),
      tailorResume: () => placeholder('tailor-to-a-job'),
      downloadResume: () => placeholder('resume-download'),
      shareResume: () => placeholder('resume-share'),
      fixWithAi: () => placeholder('ats-fix'),
      goBack: () => router.back(),
    }),
    [openCreateSheet, openMenuFor, placeholder, router],
  );
}
