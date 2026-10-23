'use client';

import { compareProfileToJob } from '@nextkin/shared/models';
import { useJdDraft, useJobJd, useProfile, useStartGeneration } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { showToast } from '@/lib/toast';

import { tailorPath, type TailorTargetRef } from '../tailorTarget';

/**
 * Build Resume on the tailor screen (toreview §126): the profile against this job (mobile BUILD
 * 04b's `compareProfileToJob`), the keywords ticked in step 4, and the build run (BUILD 04c's
 * `origin: 'build'`), whose added skills go on the resume and on the profile.
 */
export function useBuildFlow(target: TailorTargetRef, on: boolean) {
  const router = useRouter();
  const profile = useProfile();
  const listingJd = useJobJd(on && target.kind === 'job' ? target.id : '');
  const pasted = useJdDraft(on && target.kind === 'jd' ? target.id : '');
  const draft = target.kind === 'jd' ? pasted.data : listingJd.data;
  const start = useStartGeneration();
  const [added, setAdded] = useState<string[]>([]);

  const comparison = useMemo(
    () => (draft && profile.data ? compareProfileToJob(draft, profile.data) : undefined),
    [draft, profile.data],
  );

  const create = () => {
    if (!draft || !comparison || start.isPending) return;
    const skipped = comparison.keywords
      .filter((k) => !k.onResume && !added.includes(k.label))
      .map((k) => k.label);
    start.mutate(
      {
        kind: 'resume',
        jdId: draft.id,
        origin: 'build',
        build: { added, skipped },
        ...(target.kind === 'job' ? { jobId: target.id } : {}),
      },
      {
        onSuccess: (generation) =>
          router.replace(tailorPath(target, { run: generation.id, mode: 'build' })),
        onError: () => showToast("We couldn't start building it. Try again.", { tone: 'error' }),
      },
    );
  };

  return {
    profile,
    comparison,
    added,
    setAdded,
    create,
    pending: start.isPending,
    failed: pasted.isError || listingJd.isError || profile.isError,
  };
}
