'use client';

import { useMemo } from 'react';

import {
  queryPhase,
  useActivity,
  useCurrentUser,
  useJobPicks,
  useResumes,
} from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AiPromoCard } from '../components/AiPromoCard';
import { FindJobsCard } from '../components/FindJobsCard';
import { QuickStartCard } from '../components/QuickStartCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { ResumeProgressCard } from '../components/ResumeProgressCard';
import { TopJobMatches } from '../components/TopJobMatches';

/** 01 · Home (Figma 286:180), at the app's compact density (`toreview.md` §16). */
export function HomeScreen() {
  const user = useCurrentUser();
  const picks = useJobPicks();
  const resumes = useResumes();
  const activity = useActivity();

  // "Your Resume Progress" is the most recently updated resume that finished generating —
  // the same rule the mobile Home applies.
  const latestResume = useMemo(
    () =>
      resumes.data
        ?.filter((resume) => resume.status === 'ready')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    [resumes.data],
  );

  // The page gates on the user: without it there is no greeting and no per-user anything.
  if (queryPhase(user) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your dashboard. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-4 pb-5')}>
      <PageHeader
        eyebrow={
          user.isPending ? <Skeleton className="h-5 w-24" /> : `Hi ${user.data?.firstName ?? ''},`
        }
        title="Build better. Land faster."
        subtitle="Everything you need to build your career, in one place."
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        <QuickStartCard />
        <FindJobsCard />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <TopJobMatches
          jobs={picks.data}
          status={queryPhase(picks)}
          onRetry={() => void picks.refetch()}
        />
        <ResumeProgressCard
          resume={latestResume}
          status={queryPhase(resumes)}
          onRetry={() => void resumes.refetch()}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <AiPromoCard />
        <RecentActivityCard
          entries={activity.data}
          status={queryPhase(activity)}
          onRetry={() => void activity.refetch()}
        />
      </div>
    </div>
  );
}
