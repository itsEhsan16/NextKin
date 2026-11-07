import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useProfile, useResumes } from '@/data/queries';
import { useFirstRunStore } from '@/features/auth';
import { firstResumeAsked, firstResumeStage } from '@/features/create/firstResume';
import { useSetupAnswers } from '@/features/create/setupAnswers';

/** Home settles first, then the question rises: never on top of the page arriving. */
const PROMPT_DELAY_MS = 700;

/**
 * The first-resume question (owner, 2026-11-08, §185–§186). A brand-new account is taken to
 * set-up and the start screen right after sign-up, which asks it. Home's pop-up is only for someone
 * who never met that screen (an account made on the web, or a quit before step 2), and it too asks
 * once: any answer, "Not now" included, is final. A user who skipped is never asked again here; the
 * flows that need a resume ask at that moment.
 */
export function useFirstResume() {
  const router = useRouter();
  const resumes = useResumes();
  const profile = useProfile();
  const justSignedUp = useFirstRunStore((state) => state.justSignedUp);
  const consume = useFirstRunStore((state) => state.consume);
  const [asked, setAsked] = useState(firstResumeAsked.wasAsked);
  const [ripe, setRipe] = useState(false);

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

  // Only while Home is the screen in front: never over a pushed screen or another tab.
  const focused = usePathname() === '/';

  const wants = stage === 'add-resume' && !asked && !justSignedUp;
  useEffect(() => {
    if (!wants || !focused) return undefined;
    const timer = setTimeout(() => setRipe(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, wants]);

  // Any answer, "Not now" included, is final: the question is never put again on Home.
  const answer = useCallback(() => {
    firstResumeAsked.markAsked();
    setAsked(true);
  }, []);

  return {
    promptOpen: wants && focused && ripe,
    later: answer,
    upload: () => {
      answer();
      router.push({ pathname: '/create/upload', params: { next: 'job' } });
    },
    fillDetails: () => {
      answer();
      router.push('/create/zero-resume');
    },
  };
}
