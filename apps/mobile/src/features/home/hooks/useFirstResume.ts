import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useProfile, useResumes } from '@/data/queries';
import { useFirstRunStore } from '@/features/auth';
import { firstResumeStage } from '@/features/create/firstResume';
import { useSetupAnswers } from '@/features/create/setupAnswers';

/**
 * Right after sign-up, an account with no resume is taken to set-up, then "Add your resume". That
 * screen is the ONE time the app asks (owner, 2026-11-08, §187): Home has no pop-up, card or
 * reminder. Whoever skips is asked again only where a resume is needed (Tailor, ATS Check, Cover
 * letter, Build), and those flows ask in place.
 */
export function useFirstResume() {
  const router = useRouter();
  const resumes = useResumes();
  const profile = useProfile();
  const justSignedUp = useFirstRunStore((state) => state.justSignedUp);
  const consume = useFirstRunStore((state) => state.consume);

  const stage = useMemo(
    () =>
      resumes.data && profile.data
        ? firstResumeStage(resumes.data, profile.data.experiences.length)
        : undefined,
    [profile.data, resumes.data],
  );

  useEffect(() => {
    if (!justSignedUp || !stage) return;
    consume();
    if (stage === 'add-resume')
      router.push(useSetupAnswers.getState().done ? '/create/start' : '/create/setup');
  }, [consume, justSignedUp, router, stage]);
}
