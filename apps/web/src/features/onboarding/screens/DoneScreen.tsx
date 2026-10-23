'use client';

import { useRouter } from 'next/navigation';

import { Skeleton } from '@/ui/Skeleton';

import { NextSteps } from '../components/NextSteps';
import { QuestionLayout } from '../components/QuestionLayout';
import { StartingPointCard } from '../components/StartingPointCard';
import { ONBOARDING_EXIT } from '../onboardingSteps';
import { useStartingPoint } from '../useStartingPoint';

/**
 * ONB 08 · Your starting point (808:348), where both ways through end. The card is built only
 * from the answers (and the saved profile behind them after a reload), is marked a draft, and
 * uses no generation quota: it is a profile summary, not a generated resume (`toreview.md` §106).
 */
export function DoneScreen() {
  const router = useRouter();
  const point = useStartingPoint();

  return (
    <QuestionLayout
      eyebrow="You’re all set"
      title={
        point.firstName
          ? `Here’s your starting point, ${point.firstName}`
          : 'Here’s your starting point'
      }
      help="Built only from your answers. Check the summary, then make your first resume for a job."
      onContinue={() => router.push(ONBOARDING_EXIT)}
      canContinue
      continueLabel="Go to my dashboard"
      hint={false}
      layout="inline"
    >
      <div className="flex flex-col gap-5">
        {point.loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <StartingPointCard
            name={point.name}
            initials={point.initials}
            headline={point.headline}
            summary={point.summary}
            skills={point.skills}
          />
        )}
        <NextSteps />
      </div>
    </QuestionLayout>
  );
}
