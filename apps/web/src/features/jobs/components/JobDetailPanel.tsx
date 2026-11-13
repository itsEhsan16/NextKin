'use client';

import { matchBasisCaption, type Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { DetailCardSkeleton } from '@/ui/DetailCardSkeleton';
import { StateView } from '@/ui/StateView';
import { EmptyStateArt } from '@/ui/illustrations';
import { tabId, UnderlineTabs } from '@/ui/UnderlineTabs';

import { JOB_DETAIL_TABS, type JobDetailTab } from '../jobDetailTabs';
import { JobAboutTab } from './JobAboutTab';
import { JobDetailActions } from './JobDetailActions';
import { JobMetaRow } from './JobMetaRow';
import { JobOverviewTab } from './JobOverviewTab';
import { JobSkillsTab } from './JobSkillsTab';
import Link from 'next/link';

import { jobPageHref, reasonsFromCriteria } from '../jobPageLibrary';
import { ReasonList, ScoreVerdict } from '@/ui/ScoreVerdict';
import { cardSurface, cardSurfaceLoading } from '@/ui/Card';

export type JobDetailPanelProps = {
  job?: Job;
  status: 'pending' | 'error' | 'success' | 'empty';
  onRetry: () => void;
  onApply: () => void;
  applied: boolean;
  /** Where the recorded application opens, once there is one. */
  applicationHref?: Route;
};

type JobDetailBodyProps = Omit<JobDetailPanelProps, 'job' | 'status' | 'onRetry'> & {
  job: Job;
  /** Fade the card's contents in: they replace a skeleton, or another job's details. */
  reveal: boolean;
};

/** The card surface every state shares. */
const CARD = cardSurface;

/**
 * The right column (304:2680). `status` has a fifth value beyond the usual three
 * (pending/error/success) — `'empty'`, for "no job selected" — since selecting is optional here,
 * unlike a normal detail screen that's always navigated *to* a specific id.
 */
export function JobDetailPanel({ job, status, onRetry, ...actions }: JobDetailPanelProps) {
  const reveal = useReveal(status === 'success', job?.id);

  if (status === 'empty') {
    return (
      <div className={cn(CARD, 'p-6')}>
        <StateView
          art={<EmptyStateArt object="globe" />}
          title="Select a job"
          message="Choose a job from the list to see its details."
        />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      // Shrinks to the column and clips, as the loaded card does on a short window.
      <div className={cn(cardSurfaceLoading, 'min-h-0 overflow-hidden p-6')}>
        <DetailCardSkeleton tags />
      </div>
    );
  }

  if (status === 'error' || !job) {
    return (
      <div className={cn(CARD, 'p-6')}>
        <StateView
          tone="danger"
          title="Couldn't load this job"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      </div>
    );
  }

  // Keyed by job id so switching jobs resets to Overview (and the card's scroll to the top),
  // without a `useEffect` — a fresh instance rather than syncing stale state to a prop.
  return <JobDetailBody key={job.id} job={job} reveal={reveal} {...actions} />;
}

/**
 * The whole card, in the redrawn board's order (304:2680): the job's header, then Apply Now and
 * Save Job straight under its meta line — so they sit in the card's first screenful at any window
 * height — then the tags, the tabs and their content, and the tailoring callout last.
 *
 * At its natural height when it fits. When a job's details are taller than the space the screen
 * gives it, the card scrolls as one unit, like LinkedIn's right pane, instead of pinning its ends
 * and squeezing the description between them (`toreview.md` §16). `min-h-0` is what lets it
 * shrink to the column and scroll.
 */
function JobDetailBody({ job, reveal, onApply, applied, applicationHref }: JobDetailBodyProps) {
  const [tab, setTab] = useState<JobDetailTab>('overview');
  const switched = useReveal(true, tab);

  return (
    <section
      aria-label={`${job.title} at ${job.company}`}
      // The frame stays put; its contents fade in (`toreview.md` §84).
      className={cn(
        CARD,
        'min-h-0 overflow-y-auto p-6 [scrollbar-width:thin]',
        reveal && '*:animate-reveal',
      )}
    >
      <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="plain" />
      {/* The title opens the job's own page (724:2). */}
      <h2 className="mt-4 text-h1 text-neutral-800">
        <Link
          href={jobPageHref(job.id)}
          className="rounded-sm transition-colors duration-press ease-standard hover:text-text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {job.title}
        </Link>
      </h2>
      <p className="mt-1 text-body-m text-text-company">{job.company}</p>
      <JobMetaRow job={job} className="mt-3" />

      {/* The verdict with its reasons (redesign R5a, S-02). A number only when the whole listing
          was read; otherwise the band and what it rests on (P11-03, G16). */}
      <JobVerdict job={job} />

      <div className="mt-5">
        <JobDetailActions
          onApply={onApply}
          applied={applied}
          applicationHref={applicationHref}
          jobId={job.id}
        />
      </div>

      <UnderlineTabs
        tabs={JOB_DETAIL_TABS}
        active={tab}
        onChange={setTab}
        label="Job detail"
        idBase={`job-${job.id}-panel`}
        className="mt-6"
      />

      {/* Keyed by tab: after the first switch, each tab's content fades in (`toreview.md` §84). */}
      <div
        key={tab}
        id={`job-${job.id}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(`job-${job.id}-panel`, tab)}
        className={cn('pt-5', switched && 'animate-reveal')}
      >
        {tab === 'overview' && <JobOverviewTab job={job} />}
        {tab === 'skills' && <JobSkillsTab job={job} />}
        {tab === 'company' && <JobAboutTab job={job} />}
      </div>
    </section>
  );
}

/** The panel's verdict: a scored ring with reasons, or the band and its basis, or nothing. */
function JobVerdict({ job }: { job: Job }) {
  if (!job.matchBand) return null;
  const reasons = reasonsFromCriteria(job, 3);
  if (job.matchScore != null && job.matchBasis?.kind === 'full') {
    return (
      <ScoreVerdict
        variant="panel"
        kind="match"
        score={job.matchScore * 100}
        band={job.matchBand}
        reasons={reasons}
        className="mt-5 rounded-lg border border-border-subtle p-4"
      />
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-lg border border-border-subtle p-4">
      <div className="flex items-center gap-2">
        <ScoreVerdict variant="pill" kind="match" band={job.matchBand} />
        {job.matchBasis && (
          <span className="text-caption-m text-text-tertiary">
            {matchBasisCaption(job.matchBasis)}
          </span>
        )}
      </div>
      <ReasonList reasons={reasons} />
    </div>
  );
}
