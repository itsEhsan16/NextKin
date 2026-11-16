'use client';

import type { Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { textLink } from '@/ui/textLink';
import { formatCoarseAge } from '@/lib/format';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { fieldBox } from '@/ui/fieldBox';
import { SearchIcon } from '@/ui/icons';
import { ArrowRight, Bookmark, LinkExternal01 } from '@/ui/lineIcons';
import { Pager, pageOf } from '@/ui/Pager';
import { JobSeekerBinocularsIllustration } from '@/ui/illustrations/JobSeekerBinocularsIllustration';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { PanelHead, panel } from './FlowChrome';

/** Four a page, as the redesigned W-FLOW 01 draws it (toreview §150). */
const PAGE = 4;

const moreLink = cn(textLink, 'flex items-center gap-1.5 pt-1 text-body-m');
const manageLink = cn(textLink, 'flex items-center gap-1.5 text-body-m text-text-brand');

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface-card transition-colors duration-press ease-standard',
        on ? 'border-brand-600' : 'border-border-default',
      )}
    >
      {on && <span className="size-2 rounded-full bg-brand-600" />}
    </span>
  );
}

/**
 * W-FLOW 01's saved jobs (849:201, redesigned in toreview §150): a panel with a search, your saved
 * jobs newest first, four a page, each with a radio, the company's mark, where, and when it was saved.
 */
export function SavedJobList({
  jobs,
  loading,
  failed,
  onRetry,
  value,
  onChange,
}: {
  jobs: readonly Job[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  value: string | null;
  onChange: (jobId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const q = query.trim().toLowerCase();
  const found = q
    ? jobs.filter((job) => `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(q))
    : jobs;
  const paged = pageOf(found, page, PAGE);
  const shown = paged.items;

  const head = (
    <>
      <PanelHead
        icon={<Bookmark className="size-5" />}
        title="Your saved jobs"
        subtitle="Choose a job you’ve saved, or add a new one."
        aside={
          <Link href={'/jobs' as Route} target="_blank" className={manageLink}>
            Manage jobs
            <LinkExternal01 aria-hidden className="size-3.5" />
          </Link>
        }
      />
      {jobs.length > 1 && (
        <label
          className={cn(
            fieldBox,
            'w-full gap-2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600',
          )}
        >
          <SearchIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search saved jobs…"
            aria-label="Search saved jobs"
            className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-tertiary"
          />
        </label>
      )}
    </>
  );

  let body;
  if (failed) {
    body = (
      <StateView
        tone="danger"
        title="Couldn't load your saved jobs"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  } else if (loading) {
    body = (
      <div className="flex flex-col gap-3" aria-label="Loading your saved jobs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (jobs.length === 0) {
    body = (
      // The empty state fills what's left of the panel, so it stands as tall as "Add a new job"
      // beside it (owner, 2026-11-17): the clay binoculars, then what to do.
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default px-6 py-8 text-center">
        <JobSeekerBinocularsIllustration className="mb-2 h-32 w-auto" />
        <p className="text-title-l font-bold text-text-primary">No saved jobs yet</p>
        <p className="max-w-xs text-body-m text-text-secondary">
          Bring one from anywhere, or save one from Jobs.
        </p>
        <Link href={'/jobs' as Route} className={moreLink}>
          Browse jobs
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <div role="radiogroup" aria-label="Your saved jobs" className="flex flex-col gap-3">
          {shown.map((job) => {
            const on = job.id === value;
            const meta = [job.company, job.location].filter(Boolean).join(' · ');
            return (
              <button
                key={job.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(job.id)}
                className={cn(
                  'flex items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition-card duration-base ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  on
                    ? 'border-brand-600 bg-surface-brand-strong shadow-card ring-1 ring-brand-600'
                    : 'border-border-default bg-surface-card hover:-translate-y-0.5 hover:border-border-brand-strong hover:shadow-card-hover',
                )}
              >
                <Radio on={on} />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card">
                  <CompanyLogo
                    company={job.company}
                    logoUrl={job.companyLogoUrl}
                    variant="inline"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-title-l font-bold text-text-primary">
                    {job.title}
                  </span>
                  <span className="block truncate text-body-m text-text-tertiary">{meta}</span>
                </span>
                {job.savedAt && (
                  <span className="shrink-0 text-body-s font-medium text-text-tertiary">
                    Saved {formatCoarseAge(job.savedAt).toLowerCase()}
                  </span>
                )}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="px-1 py-3 text-body-m text-text-tertiary">
              No saved job matches “{query.trim()}”.
            </p>
          )}
        </div>
        {found.length > 0 && (
          <Pager
            page={paged.page}
            pages={paged.pages}
            onPage={setPage}
            shown={shown.length}
            total={found.length}
            noun="jobs"
            label="Saved job pages"
          />
        )}
      </>
    );
  }

  return (
    // flex-1: as tall as the column, which the grid stretches to "Add a new job" beside it.
    <div className={cn(panel, 'flex-1')}>
      {head}
      {body}
    </div>
  );
}
