'use client';

import type { Job, MatchBand } from '@nextkin/shared/models';
import { MATCH_BAND_LABEL } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { textLink } from '@/ui/textLink';
import { formatCoarseAge } from '@/lib/format';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { fieldBox } from '@/ui/fieldBox';
import { SearchIcon } from '@/ui/icons';
import { ArrowRight } from '@/ui/lineIcons';
import { AssistantBookmarkIllustration } from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { ColumnHead } from './FlowChrome';

/** W-FLOW 01 draws the bands as green, amber and grey pills (849:229, 849:244, 849:283). */
const PILL: Record<MatchBand, string> = {
  strong: 'bg-success-surface text-success-text',
  good: 'bg-warning-50 text-warning-text',
  fair: 'bg-surface-muted text-text-secondary',
  weak: 'bg-surface-muted text-text-secondary',
};

/** The board lists five; the rest open in place under "See all saved jobs". */
const FIRST = 5;

const moreLink = cn(textLink, 'flex items-center gap-1.5 self-start pt-1 text-body-m');

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
 * W-FLOW 01's left column (849:201): your saved jobs, newest first, as cards with a radio, the
 * company's mark, the role, where and when it was saved, and how well you match. A search sits in
 * the column's head; five show, the rest open under "See all saved jobs".
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
  const [all, setAll] = useState(false);
  const q = query.trim().toLowerCase();
  const found = q
    ? jobs.filter((job) => `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(q))
    : jobs;
  const shown = all || q ? found : found.slice(0, FIRST);

  const head = (
    <ColumnHead
      art={<AssistantBookmarkIllustration className="h-auto w-11" />}
      title="Your saved jobs"
      subtitle={jobs.length > 0 ? `${jobs.length} saved · newest first` : 'Jobs you save show here'}
      aside={
        jobs.length > 1 ? (
          <label
            className={cn(
              fieldBox,
              'w-60 gap-2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600',
            )}
          >
            <SearchIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved jobs"
              aria-label="Search saved jobs"
              className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-tertiary"
            />
          </label>
        ) : undefined
      }
    />
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
      <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-border-default px-4 py-5">
        <p className="text-body-l text-text-secondary">
          No saved jobs yet. Bring one from anywhere, or save one from Jobs.
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
            const meta = [
              job.company,
              job.location,
              job.savedAt ? `Saved ${formatCoarseAge(job.savedAt).toLowerCase()}` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={job.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(job.id)}
                className={cn(
                  'flex items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  on
                    ? 'border-brand-600 bg-surface-brand-strong ring-1 ring-brand-600'
                    : 'border-border-default bg-surface-card hover:border-neutral-400',
                )}
              >
                <Radio on={on} />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-faint bg-surface-card">
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
                {job.matchBand && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
                      PILL[job.matchBand],
                    )}
                  >
                    {MATCH_BAND_LABEL[job.matchBand]}
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
        {!q && !all && jobs.length > FIRST && (
          <button type="button" onClick={() => setAll(true)} className={moreLink}>
            See all saved jobs ({jobs.length})
            <ArrowRight aria-hidden className="size-4" />
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {head}
      {body}
    </div>
  );
}
