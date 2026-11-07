import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useProfile, useResumes } from '@/data/queries';
import { useFirstRunStore } from '@/features/auth';
import { firstResumePrompt, firstResumeStage } from '@/features/create/firstResume';
import { useSetupAnswers } from '@/features/create/setupAnswers';

/** Home settles first, then the question rises: never on top of the page arriving. */
const PROMPT_DELAY_MS = 700;

/**
 * The first-resume nudge on Home (owner, 2026-11-08, §185). A brand-new account is taken to
 * set-up or the start screen right after sign-up, as before. Someone who skips that and still has
 * no resume is asked on Home with a pop-up: upload, or fill in their details one question at a
 * time. "Not now" puts it off until the next launch. The old "Your first resume" card is gone.
 */
export function useFirstResume() {
  const router = useRouter();
  const resumes = useResumes();
  const profile = useProfile();
  const justSignedUp = useFirstRunStore((state) => state.justSignedUp);
  const consume = useFirstRunStore((state) => state.consume);
  const [snoozed, setSnoozed] = useState(firstResumePrompt.isSnoozed);
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

  const wants = stage === 'add-resume' && !snoozed && !justSignedUp;
  useEffect(() => {
    if (!wants || !focused) return undefined;
    const timer = setTimeout(() => setRipe(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, wants]);

  // Any answer, or "Not now", puts the question away for this launch: it never re-asks on the
  // way back from the screen it just opened.
  const snooze = useCallback(() => {
    firstResumePrompt.snooze();
    setSnoozed(true);
  }, []);

  return {
    promptOpen: wants && focused && ripe,
    later: snooze,
    upload: () => {
      snooze();
      router.push({ pathname: '/create/upload', params: { next: 'job' } });
    },
    fillDetails: () => {
      snooze();
      router.push('/create/zero-resume');
    },
  };
}
