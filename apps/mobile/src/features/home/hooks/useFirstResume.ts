import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useProfile, useResumes } from '@/data/queries';
import { useFirstRunStore } from '@/features/auth';
import { firstResumeCard, firstResumeStage } from '@/features/create/firstResume';
import { useSetupAnswers } from '@/features/create/setupAnswers';

/**
 * Home's part in a new account's first resume (toreview §145.2). Straight after sign-up it opens
 * the first-resume screen, once. Whoever skips that, or came back later, gets the card until a
 * resume has been made for a job. An account that already has what it needs is left alone.
 */
export function useFirstResume() {
  const router = useRouter();
  const resumes = useResumes();
  const profile = useProfile();
  const justSignedUp = useFirstRunStore((state) => state.justSignedUp);
  const consume = useFirstRunStore((state) => state.consume);
  const [dismissed, setDismissed] = useState(firstResumeCard.isDismissed);

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
    // A new account answers the two quick questions first, then adds a resume (§172).
    if (stage === 'add-resume')
      router.push(useSetupAnswers.getState().done ? '/create/start' : '/create/setup');
  }, [consume, justSignedUp, router, stage]);

  const dismiss = useCallback(() => {
    firstResumeCard.dismiss();
    setDismissed(true);
  }, []);

  return {
    /** The card's stage, or undefined when there is no card to show. */
    cardStage: stage && stage !== 'done' && !dismissed ? stage : undefined,
    dismiss,
    addResume: () => router.push('/create/start'),
    pickJob: () => router.push('/create/build'),
  };
}
