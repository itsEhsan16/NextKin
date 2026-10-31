'use client';

import type { Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useRaiseApplyAsk } from '@/features/applications/applyAsk';
import { cn } from '@/lib/cn';
import { formatApplicants, formatPostedAge } from '@/lib/format';
import { brandButton } from '@/ui/brandButton';
import { iconButton } from '@/ui/iconButton';
import { ChevronRightIcon, ExternalLinkIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';

import { applyUrl } from '../../jobPageLibrary';
import { SaveButton } from '../SaveButton';

export type JobPageTab = 'overview' | 'company';

const TABS: { id: JobPageTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'company', label: 'Company' },
];

type ListingBar = {
  variant?: 'listing';
  tab: JobPageTab;
  onTab: (tab: JobPageTab) => void;
  onToggleSave: () => void;
  savePending: boolean;
};

/** A job description's own page (toreview §110): no listing facts to show, its own actions. */
type JdBar = { variant: 'jd'; backHref: Route; backLabel: string; actions?: ReactNode };

/**
 * The card's own bar (730:4): back to the jobs, the Overview and Company tabs, when it was posted
 * and how many applied, Save, and Apply on the employer's site. The application happens there, so
 * the button opens it in a new tab.
 *
 * On a job description's page the bar keeps its back button and Apply (only when the JD came from
 * a link), drops what only a listing has — tabs, posted, applicants, Save — and carries the page's
 * own actions instead.
 */
export function JobPageTop(props: { job: Job } & (ListingBar | JdBar)) {
  const { job } = props;
  const jd = props.variant === 'jd';
  const back = jd ? props.backHref : ('/jobs' as Route);
  return (
    <div className="flex flex-wrap items-center gap-3 px-8 pt-6">
      <Link
        href={back}
        aria-label={jd ? props.backLabel : 'Back to jobs'}
        className={cn(
          iconButton,
          '-ml-1 bg-neutral-50 text-text-secondary hover:text-text-primary',
        )}
      >
        <ChevronRightIcon aria-hidden className="size-3.5 rotate-180" />
      </Link>
      {jd ? <JdBarEnd job={job} actions={props.actions} /> : <ListingBarEnd {...props} />}
    </div>
  );
}

function ApplyLink({ job }: { job: Job }) {
  const raise = useRaiseApplyAsk();
  return (
    <a
      href={applyUrl(job)}
      target="_blank"
      rel="noreferrer"
      onClick={() => raise({ jobId: job.id })}
      className={cn(brandButton, 'h-control-md gap-2 rounded-full px-4 text-body-m font-semibold')}
    >
      Apply on company site
      <ExternalLinkIcon aria-hidden className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function JdBarEnd({ job, actions }: { job: Job; actions?: ReactNode }) {
  return (
    <>
      <span className="text-body-m font-medium text-text-secondary">Job description</span>
      <span className="flex-1" />
      {actions}
      {job.applyUrl && <ApplyLink job={job} />}
    </>
  );
}

function ListingBarEnd({ job, tab, onTab, onToggleSave, savePending }: { job: Job } & ListingBar) {
  return (
    <>
      <div role="tablist" aria-label="Job sections" className="ml-1 flex items-center gap-5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={cn(
              pressable,
              'border-b-2 py-1.5 text-body-m font-medium',
              tab === id
                ? 'border-brand-600 text-text-brand'
                : 'border-transparent text-text-secondary hover:text-text-primary',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="flex-1" />
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption-m text-text-brand">
        Posted {formatPostedAge(job.postedAt).replace(/^1 day ago$/, 'yesterday')}
      </span>
      {job.applicantsCount != null && (
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption-m text-text-secondary">
          {formatApplicants(job.applicantsCount).replace(/\+? applied$/, ' applicants')}
        </span>
      )}
      <SaveButton saved={job.isSaved} onToggle={onToggleSave} pending={savePending} />
      <ApplyLink job={job} />
    </>
  );
}
