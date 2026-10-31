'use client';

import type { ApplicationAsk, ApplicationTarget, Job } from '@nextkin/shared/models';
import { applyPageOf, useAskAboutApplication } from '@nextkin/shared/queries';
import { useCallback } from 'react';
import { create } from 'zustand';

import { showToast } from '@/lib/toast';

/**
 * "Did you apply?" (owner, 2026-10-31). NextKin submits nothing, so the Applied list holds only
 * what the candidate tells us. Whatever raises the question puts it here, and the one dialog in the
 * app shell shows it.
 */
type ApplyAskState = {
  ask: ApplicationAsk | null;
  open: (ask: ApplicationAsk) => void;
  close: () => void;
};

export const useApplyAskStore = create<ApplyAskState>((set) => ({
  ask: null,
  open: (ask) => set({ ask }),
  close: () => set({ ask: null }),
}));

/** Asks about a job, or the job a resume was made for, when there is one to ask about. */
export function useRaiseApplyAsk() {
  const { mutate } = useAskAboutApplication();
  const open = useApplyAskStore((state) => state.open);
  return useCallback(
    (target: ApplicationTarget) =>
      mutate(target, {
        onSuccess: (ask) => {
          if (ask) open(ask);
        },
      }),
    [mutate, open],
  );
}

/** "Apply": the employer's page in a new tab, then the question for when the candidate is back. */
export function useApplyOnSite() {
  const raise = useRaiseApplyAsk();
  return useCallback(
    (job: Job) => {
      const page = applyPageOf(job);
      if (!page) {
        showToast('This job has no page to apply on.', { tone: 'error' });
        return;
      }
      window.open(page, '_blank', 'noreferrer');
      raise({ jobId: job.id });
    },
    [raise],
  );
}
