'use client';

import {
  INSIGHTS_RANGE_LABEL,
  type CareerInsights,
  type InsightsRange,
} from '@nextkin/shared/models';
import { queryPhase, useInsights } from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { SelectField } from '@/ui/SelectField';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import {
  InsightsHeroIllustration,
  NavInterviewPrepIllustration,
  ProfilePaperPlaneIllustration,
  ProfileTermsIllustration,
  InsightsStarIllustration,
  SettingsCalendarIllustration,
} from '@/ui/illustrations';

import { CareerProgressChart } from '../components/CareerProgressChart';
import {
  AiInsightsCard,
  CardHead,
  FunnelCard,
  insightPanel,
  SharesCard,
  StatCard,
  InsightsSweep,
} from '../components/InsightsCards';
import { RecommendationCard } from '../components/RecommendationCard';
import { PREVIOUS_LABEL, RANGES, TOTAL_CAPTION } from '../insightsLibrary';

const rangeLabel = (range: InsightsRange) => INSIGHTS_RANGE_LABEL[range];

/** "Career Progress" (462:2), with its own window: it can look further back than the page. */
function ProgressCard({ pageRange }: { pageRange: InsightsRange }) {
  const [range, setRange] = useState<InsightsRange | null>(null);
  const shown = range ?? pageRange;
  const insights = useInsights(shown);
  const chartLoaded = useReveal(Boolean(insights.data));
  return (
    <section aria-labelledby="insights-progress" className={insightPanel}>
      <CardHead
        id="insights-progress"
        title="Career Progress"
        subtitle="Your job search activity over time."
        aside={
          <SelectField
            label="Career Progress window"
            value={shown}
            options={RANGES}
            labelOf={rangeLabel}
            onChange={setRange}
            className="w-auto"
          />
        }
      />
      <div className="mt-6">
        {insights.data ? (
          <div className={cn(chartLoaded && 'animate-reveal')}>
            <CareerProgressChart
              progress={insights.data.progress}
              caption={TOTAL_CAPTION[insights.data.range]}
            />
          </div>
        ) : insights.isError ? (
          <StateView
            tone="danger"
            title="Couldn't load the chart"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void insights.refetch()}
          />
        ) : (
          <Skeleton className="h-[200px] rounded-md" />
        )}
      </div>
    </section>
  );
}

function Dashboard({ data, range }: { data: CareerInsights; range: InsightsRange }) {
  const previous = PREVIOUS_LABEL[data.range];
  return (
    <>
      <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
        <StatCard
          Art={ProfileTermsIllustration}
          label="Jobs Analyzed"
          stat={data.jobsAnalyzed}
          footnote={previous}
        />
        <StatCard
          Art={ProfilePaperPlaneIllustration}
          label="Applications Sent"
          stat={data.applicationsSent}
          footnote={previous}
        />
        <StatCard
          Art={NavInterviewPrepIllustration}
          label="Interviews"
          stat={data.interviews}
          footnote={previous}
        />
        <StatCard
          Art={InsightsStarIllustration}
          label="Resume Score"
          stat={data.resumeScore}
          outOf={100}
          footnote={`Based on ${data.resumeScore.basedOn}+ job matches`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,560fr)_minmax(0,290fr)_minmax(0,298fr)]">
        <ProgressCard pageRange={range} />
        <FunnelCard funnel={data.funnel} />
        <AiInsightsCard insights={data.aiInsights} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,350fr)_minmax(0,340fr)_minmax(0,458fr)]">
        <SharesCard
          id="insights-skills"
          title="Top Skills in Demand"
          subtitle="Skills most commonly found in your target jobs."
          shares={data.topSkills}
          link={{ href: '/profile?tab=skills' as Route, label: 'Your skills' }}
        />
        <SharesCard
          id="insights-roles"
          title="Target Roles"
          subtitle="Roles you're most likely to land."
          shares={data.targetRoles}
        />
        <RecommendationCard recommendation={data.recommendation} />
      </div>
    </>
  );
}

/**
 * Insights (461:14), which replaced its coming-soon page: four stats against the window before,
 * the progress chart, the funnel and AI observations, then the skills and roles the target jobs
 * ask for and the role to aim at. One window picker drives the page; the chart has its own.
 */
export function InsightsScreen() {
  const [range, setRange] = useState<InsightsRange>('30d');
  const insights = useInsights(range);
  const loaded = useReveal(Boolean(insights.data));

  if (queryPhase(insights) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your insights. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void insights.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-6 pb-10')}>
      <PageHeader
        eyebrow="Insights"
        title="Your Career Insights"
        subtitle={
          // Two lines, as the board sets it, so the header is tall enough for its art.
          <span className="block max-w-[520px]">
            Track your progress, understand your strengths, and get AI-powered recommendations to
            land your next big opportunity.
          </span>
        }
        aside={
          <div className="flex shrink-0 items-end gap-10">
            <InsightsHeroIllustration
              aria-hidden
              className="pointer-events-none hidden h-[72px] w-auto translate-y-3 lg:block"
            />
            <SelectField
              label="Insights window"
              value={range}
              options={RANGES}
              labelOf={rangeLabel}
              onChange={setRange}
              leading={<SettingsCalendarIllustration aria-hidden className="h-auto w-[19px]" />}
              className="w-auto font-semibold"
            />
          </div>
        }
      />

      {insights.data ? (
        <div className={cn('flex flex-col gap-6', loaded && 'animate-reveal')}>
          <InsightsSweep.Provider value={loaded}>
            <Dashboard data={insights.data} range={range} />
          </InsightsSweep.Provider>
        </div>
      ) : (
        // The dashboard's three rows at their loaded shapes, stacking below `xl` as it does.
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
            {[0, 1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,560fr)_minmax(0,290fr)_minmax(0,298fr)]">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-[310px] rounded-lg" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,350fr)_minmax(0,340fr)_minmax(0,458fr)]">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-[320px] rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
