import type { CoverLetterTone, Generation } from '@/data/models';
import { useStartGeneration, useSubscription } from '@/data/queries';

import { otherTones, runTone } from '../components/coverRun';
import { useGenerationsActions } from './useGenerationsActions';

export const COVER_TONE_START_FAILED = "We couldn't start a new draft. Try again.";

/**
 * COVER 03's "Try another tone" (V2 §7.10): a fresh run from the same resume and job in the new
 * tone, replacing this screen. The quota is read the way the setup screen reads it — §13.5 wants
 * a spent allowance to open the plans instead of starting work, and an allowance that has not
 * loaded is unknown, so the chips wait for it.
 */
export function useCoverTone(generation: Generation, onError: (message: string) => void) {
  const actions = useGenerationsActions();
  const subscription = useSubscription();
  const start = useStartGeneration();

  const usage = subscription.data?.usage;
  const spent = usage ? usage.coverLettersUsed >= usage.coverLettersLimit : false;
  const { sourceResumeId, jobId } = generation;

  const pick = (tone: CoverLetterTone) => {
    if (!usage || start.isPending || !sourceResumeId) return;
    if (spent) return actions.openUpgrade('cover_letters');
    start.mutate(
      { kind: 'cover_letter', sourceResumeId, ...(jobId ? { jobId } : {}), tone },
      {
        onSuccess: (next) => actions.openRun(next.id),
        onError: () => onError(COVER_TONE_START_FAILED),
      },
    );
  };

  return {
    tones: otherTones(runTone(generation)),
    pick,
    spent,
    // Without the source resume there is nothing to rewrite from; without the plan, no cap.
    disabled: !usage || start.isPending || !sourceResumeId,
  };
}
