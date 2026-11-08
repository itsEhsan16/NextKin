'use client';

import { matchBasisCaption, type Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { AiCallout } from '@/ui/AiCallout';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { DetailCardSkeleton } from '@/ui/DetailCardSkeleton';
import { StateView } from '@/ui/StateView';
import { UnderlineTabs } from '@/ui/UnderlineTabs';
import { iconButton } from '@/ui/iconButton';
import { MoreHorizontalIcon } from '@/ui/icons';

import { JOB_DETAIL_TABS, type JobDetailTab } from '../jobDetailTabs';
import { JobAboutTab } from './JobAboutTab';
import { JobDetailActions } from './JobDetailActions';
import { JobEmptyTab } from './JobEmptyTab';
import { JobMetaRow } from './JobMetaRow';
import { JobOverviewTab } from './JobOverviewTab';
import { JobSkillsTab } from './JobSkillsTab';
import { JobTagPills } from './JobTagPills';
import { MatchBadge } from './MatchBadge';
import Link from 'next/link';

import { jobPageHref, tailorHref } from '../jobPageLibrary';
import { cardSurface, cardSurfaceLoading } from '@/ui/Card';
import { Soon, soonControl } from '@/ui/Soon';

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
        <StateView title="Select a job" message="Choose a job from the list to see its details." />
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
      <div className="flex items-start justify-between">
        <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="plain" />
        <div className="-mr-2 flex items-center gap-1">
          <MatchBadge score={job.matchScore} band={job.matchBand} />
          <Soon>
            <button
              aria-disabled="true"
              type="button"
              aria-label="More options"
              className={cn(iconButton, 'text-text-tertiary hover:text-text-primary', soonControl)}
            >
              <MoreHorizontalIcon className="size-5" />
            </button>
          </Soon>
        </div>
      </div>
      {/* What the number rests on (G16), spec-derived until an artboard draws it (toreview §105.18). */}
      {job.matchScore != null && job.matchBasis && (
        <p className="mt-1.5 text-right text-caption-m text-text-tertiary">
          {matchBasisCaption(job.matchBasis)}
        </p>
      )}

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

      <div className="mt-5">
        <JobDetailActions
          onApply={onApply}
          applied={applied}
          applicationHref={applicationHref}
          jobId={job.id}
        />
      </div>

      <JobTagPills tags={job.tags} max={4} size="md" className="mt-5" />
      <UnderlineTabs
        tabs={JOB_DETAIL_TABS}
        active={tab}
        onChange={setTab}
        label="Job detail"
        className="mt-6"
      />

      {/* Keyed by tab: after the first switch, each tab's content fades in (`toreview.md` §84). */}
      <div key={tab} className={cn('pt-5', switched && 'animate-reveal')}>
        {tab === 'overview' && <JobOverviewTab job={job} />}
        {tab === 'about' && <JobAboutTab job={job} />}
        {tab === 'skills' && <JobSkillsTab job={job} />}
        {tab === 'benefits' && (
          <JobEmptyTab
            title="Nothing here yet"
            message="This company hasn't listed benefits for this role."
          />
        )}
        {tab === 'reviews' && (
          <JobEmptyTab
            title="Nothing here yet"
            message="No reviews are available for this company yet."
          />
        )}
      </div>

      {/* "Tailor your resume for this job" (304:2761): the card's last element since the redraw.
          Opens the three-step tailor flow (734:2, `toreview.md` §103). */}
      <div className="mt-6">
        <AiCallout
          title="Tailor your resume for this job"
          message="Increase your chances with AI-powered suggestions."
          href={tailorHref(job.id)}
        />
      </div>
    </section>
  );
}
