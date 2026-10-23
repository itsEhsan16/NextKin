import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { copyToClipboard, shareText } from '@/lib';

import { useJobsStore } from '../jobsStore';

/** Said when the OS sheet never appeared and the details went to the clipboard instead. */
export const JOB_LINK_COPIED = 'Job copied to your clipboard';
/** Said when neither the share sheet nor the clipboard was reachable. */
export const JOB_SHARE_UNAVAILABLE = "This device can't share right now";

/** Every tap target on the Jobs screens resolves here, keeping routing out of the components. */
export function useJobsActions() {
  const router = useRouter();
  // The three pickers are hosted above the tab bar in the tabs layout, so opening one is a store
  // write rather than a navigation (Figma JOBS 04 for filters; sort and location match it).
  const openFilters = useJobsStore((state) => state.openFilters);
  const openSortSheet = useJobsStore((state) => state.openSort);
  const openLocationSheet = useJobsStore((state) => state.openLocation);
  const showToast = useJobsStore((state) => state.showToast);

  /**
   * There is no share screen: the OS sheet is the whole flow. Android resolves the same way
   * whether the link reached anywhere or not, so only the case where no sheet appeared at all is
   * worth reporting — and then the clipboard is the fallback that still leaves the reader
   * something to paste.
   */
  const shareJob = useCallback(
    (job: Job) => {
      // Text, and deliberately no link: `Job` carries the company's website but not the listing's
      // own URL, and a share that looks like a job posting and opens stripe.com is worse than one
      // that plainly names the role. Add `applyUrl` to the model and this can carry it.
      const message = [
        `${job.title} at ${job.company}`,
        [job.location, REMOTE_TYPE_LABEL[job.remote]].filter(Boolean).join(' · '),
        'Shared from NextKin',
      ].join('\n');
      void (async () => {
        const result = await shareText(message, { title: `${job.title} at ${job.company}` });
        if (result !== 'unavailable') return;
        const copied = await copyToClipboard(message);
        if (copied === 'done') showToast(JOB_LINK_COPIED);
        else showToast(JOB_SHARE_UNAVAILABLE, 'error');
      })();
    },
    [showToast],
  );

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      openFilters,
      openSort: openSortSheet,
      openLocationPicker: openLocationSheet,
      openJob: (job: Job) => router.push({ pathname: '/jobs/[id]', params: { id: job.id } }),
      viewAllJobs: () => router.navigate('/(tabs)/jobs'),
      goBack: () => router.back(),
      shareJob,
      /** The employer behind the listing, and their other open roles (V2 §7.13). */
      openCompany: (job: Job) =>
        router.push({ pathname: '/jobs/[id]/company', params: { id: job.id } }),
      /** Every criterion behind the match percentage, with the honesty note (V2 §7.13). */
      openFullCriteria: (job: Job) =>
        router.push({ pathname: '/jobs/[id]/criteria', params: { id: job.id } }),
      /** Carries the job through, so the intake screen opens with its description already chosen. */
      tailorResume: (job: Job) =>
        router.push({ pathname: '/create/tailor', params: { jobId: job.id } }),
      /** TAILOR 01's CTA: the compare step (TAILOR 02) for this job and the resume picked for it. */
      openTailorCompare: (jobId: string, resumeId: string) =>
        router.push({ pathname: '/create/tailor', params: { jobId, resumeId } }),
      /** ZERO 00b's "Start from nothing": Zero Resume, remembering the job it was asked from. */
      openZeroResume: (jobId: string) =>
        router.push({ pathname: '/create/zero-resume', params: { jobId } }),
      /** Where the criteria screen sends someone whose profile is too thin to match against. */
      openProfileSkills: () => router.push('/profile/skills'),
    }),
    [openFilters, openLocationSheet, openSortSheet, router, shareJob],
  );
}
