'use client';

import type { Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { useReveal } from '@/lib/useReveal';
import { AiCallout } from '@/ui/AiCallout';
import { cardSurface, cardSurfaceLoading } from '@/ui/Card';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { DetailCardSkeleton } from '@/ui/DetailCardSkeleton';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { iconButton } from '@/ui/iconButton';
import { MoreVerticalIcon } from '@/ui/icons';
import { StateView } from '@/ui/StateView';
import { tabId, UnderlineTabs } from '@/ui/UnderlineTabs';

import { JOB_DETAIL_TABS, type JobDetailTab } from '../jobDetailTabs';
import { jobPageHref, tailorHref } from '../jobPageLibrary';
import { BulletList } from './BulletList';
import { JobAboutTab } from './JobAboutTab';
import { JobDetailActions } from './JobDetailActions';
import { JobMetaRow } from './JobMetaRow';
import { JobOverviewTab } from './JobOverviewTab';
import { JobSkillsTab } from './JobSkillsTab';
import { JobTagPills } from './JobTagPills';
import { MatchBadge } from './MatchBadge';

export type JobDetailPanelProps = {
  job?: Job;
  status: 'pending' | 'error' | 'success' | 'empty';
  onRetry: () => void;
  onApply: () => void;
  applied: boolean;
  /** Where the recorded application opens, once there is one. */
  applicationHref?: Route;
  /** Save or unsave the job, from the ⋯ menu. */
  onToggleSave: () => void;
  savePending: boolean;
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
      // A plain blank card filling the column (266:5, owner 2026-11-13): no art, no copy. The
      // words stay for screen readers so the column still says what it is waiting for.
      <section aria-label="Job details" className={cn(CARD, 'min-h-0 flex-1')}>
        <p className="sr-only">Select a job from the list to see its details.</p>
      </section>
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
 * The card as the board draws it (304:2680), back at the owner's word and polished (2026-11-13:
 * "I like this design, so bring it back … Upper part stay fixed"). The header stays put: logo,
 * match badge and ⋯ menu; the title (it opens the job's page), company and meta line; Apply Now
 * and View Job; the skill pills; the tabs. Only the tab's content and the tailoring callout under
 * it scroll, so the job and its actions are always in view.
 */
function JobDetailBody({
  job,
  reveal,
  onApply,
  applied,
  applicationHref,
  onToggleSave,
  savePending,
}: JobDetailBodyProps) {
  const [tab, setTab] = useState<JobDetailTab>('overview');
  const switched = useReveal(true, tab);
  const panelId = `job-${job.id}-panel`;

  return (
    <section
      aria-label={`${job.title} at ${job.company}`}
      // The frame stays put; its contents fade in (`toreview.md` §84).
      className={cn(CARD, 'flex min-h-0 flex-col overflow-hidden', reveal && '*:animate-reveal')}
    >
      <div className="shrink-0 px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="plain" />
          <div className="-mr-2 flex items-center gap-1">
            <MatchBadge score={job.matchScore} band={job.matchBand} />
            <JobMenu job={job} onToggleSave={onToggleSave} savePending={savePending} />
          </div>
        </div>

        <h2 className="mt-4 text-h1 text-text-primary">
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

        {job.tags.length > 0 && <JobTagPills tags={job.tags} max={4} size="md" className="mt-4" />}

        <UnderlineTabs
          tabs={JOB_DETAIL_TABS}
          active={tab}
          onChange={setTab}
          label="Job detail"
          idBase={panelId}
          className="mt-5"
        />
      </div>

      {/* Keyed by tab: a switch starts at the top and fades in (`toreview.md` §84). */}
      <div
        key={tab}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(panelId, tab)}
        tabIndex={0}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 scrollbar-thin focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
          switched && 'animate-reveal',
        )}
      >
        {tab === 'overview' && <JobOverviewTab job={job} />}
        {tab === 'about' && <JobAboutTab job={job} />}
        {tab === 'skills' && <JobSkillsTab job={job} />}
        {tab === 'benefits' && <JobBenefitsTab job={job} />}
        {tab === 'reviews' && (
          <StateView
            title="No reviews yet"
            message={`Reviews of ${job.company} aren't available on NextKin yet.`}
            className="py-8"
          />
        )}

        {/* "Tailor your resume for this job" (304:2761), the card's last element: the three-step
            tailor flow for this job (734:2, `toreview.md` §103). */}
        <div className="mt-6">
          <AiCallout
            title="Tailor your resume for this job"
            message="Increase your chances with AI-powered suggestions."
            href={tailorHref(job.id)}
          />
        </div>
      </div>
    </section>
  );
}

/** Benefits, or the listing's perks when there's no full list; plainly none when neither. */
function JobBenefitsTab({ job }: { job: Job }) {
  const benefits = job.benefits?.length ? job.benefits : (job.perks ?? []);
  if (benefits.length === 0) {
    return (
      <StateView
        title="No benefits listed"
        message={`${job.company} hasn't listed benefits for this role.`}
        className="py-8"
      />
    );
  }
  return (
    <div>
      <h3 className="text-title-l font-bold text-text-primary">Benefits</h3>
      <BulletList items={benefits} className="mt-1.5" />
    </div>
  );
}

/** The ⋯ menu (304:2697): save the job, or copy its link. */
function JobMenu({
  job,
  onToggleSave,
  savePending,
}: {
  job: Job;
  onToggleSave: () => void;
  savePending: boolean;
}) {
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`More for ${job.title}`}
          className={cn(iconButton, 'text-text-tertiary hover:text-text-primary')}
        >
          <MoreVerticalIcon className="size-5" />
        </button>
      }
    >
      <MenuItem onSelect={onToggleSave} disabled={savePending}>
        {job.isSaved ? 'Remove from saved' : 'Save job'}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          const url = `${window.location.origin}${jobPageHref(job.id)}`;
          void navigator.clipboard
            ?.writeText(url)
            .then(() => showToast('Link copied'))
            .catch(() => showToast("Couldn't copy the link", { tone: 'error' }));
        }}
      >
        Copy link
      </MenuItem>
    </FilterDropdown>
  );
}
