'use client';

import { useFitToOnePage } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useRaiseApplyAsk } from '@/features/applications/applyAsk';
import { resumeHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { iconButton } from '@/ui/iconButton';
import { Check, ChevronRight, DotsVertical, Download01, Edit03 } from '@/ui/lineIcons';
import { StableLabel } from '@/ui/StableLabel';

import type { Job } from '@nextkin/shared/models';

import { JobLogoTile } from '../flow/EntityRow';
import { fitMessage } from './FitToPage';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

const BUTTON = 'h-control-md gap-2 rounded-md px-4 text-body-m font-semibold';

/**
 * "Resume review" (toreview §121, from the owner's mockup): back, the title, the file with its
 * "Saved" pill, then a "⋯" menu for the rarer actions (fit to one page, apply, open in Resumes),
 * Edit resume and Download PDF.
 */
export function ReviewHeader({
  job,
  backHref,
  resumeId,
  file,
  pages,
  apply,
  applyLabel,
  downloading,
  onDownload,
}: {
  /** The job it was made for: its mark and name lead the header (W-FLOW 05, 859:11). */
  job?: Job;
  backHref?: Route;
  resumeId: string;
  file: string;
  pages: number;
  apply: string | null;
  applyLabel: string;
  downloading: boolean;
  onDownload: () => void;
}) {
  const router = useRouter();
  const fit = useFitToOnePage(resumeId);
  const raiseApplyAsk = useRaiseApplyAsk();
  return (
    <header className="flex flex-wrap items-center gap-x-3.5 gap-y-3 in-data-drawer:pr-12">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back to the job"
          className={cn(
            iconButton,
            'size-10 shrink-0 rounded-full border border-border-subtle bg-surface-card shadow-card',
          )}
        >
          <ChevronRight aria-hidden className="size-4.5 rotate-180 text-text-primary" />
        </Link>
      )}
      {job && <JobLogoTile job={job} />}
      <div className="min-w-0">
        <p className="truncate text-caption-m font-medium text-text-tertiary">
          {job ? (job.company ? `${job.title} · ${job.company}` : job.title) : file}
        </p>
        <h1 className="text-h1 font-bold tracking-tight text-text-primary">Resume review</h1>
      </div>
      <Link
        href={resumeHref(resumeId)}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-surface px-2.5 py-0.5 text-caption-m font-semibold text-success-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <Check aria-hidden className="size-4" />
        Saved to Resumes
      </Link>
      <span className="flex-1" />
      <FilterDropdown
        align="end"
        trigger={
          <button
            type="button"
            aria-label="More actions"
            title="More actions"
            className={cn(
              iconButton,
              'size-control-md border border-border-default bg-surface-card text-text-secondary hover:text-text-primary',
            )}
          >
            <DotsVertical aria-hidden className="size-4.5" />
          </button>
        }
      >
        {pages > 1 && (
          <MenuItem
            disabled={fit.isPending}
            onSelect={() => {
              // The menu closes on select, so the wait is said where it is seen (toreview §131).
              showToast('Fitting your resume to one page…', { tone: 'info' });
              fit.mutate(undefined, {
                onSuccess: (result) =>
                  showToast(fitMessage(result), {
                    tone: result.status === 'failed' ? 'error' : 'success',
                  }),
                onError: () =>
                  showToast('Fitting isn’t available right now. Try again in a moment.', {
                    tone: 'error',
                  }),
              });
            }}
          >
            {fit.isPending ? 'Fitting to one page…' : 'Fit to one page'}
          </MenuItem>
        )}
        {apply && (
          <MenuItem
            onSelect={() => {
              window.open(apply, '_blank', 'noreferrer');
              raiseApplyAsk({ resumeId });
            }}
          >
            Apply on {applyLabel}
          </MenuItem>
        )}
        <MenuItem onSelect={() => router.push(resumeHref(resumeId))}>Open in Resumes</MenuItem>
      </FilterDropdown>
      <Link
        href={`/resumes/${resumeId}/edit` as Route}
        className={cn(BUTTON_VARIANT.secondary, BUTTON)}
      >
        <Edit03 aria-hidden className="size-4" />
        Edit resume
      </Link>
      <button
        type="button"
        disabled={downloading || !resumeId}
        onClick={onDownload}
        className={cn(BUTTON_VARIANT.primary, BUTTON)}
      >
        <Download01 aria-hidden className="size-4" />
        <StableLabel label="Download PDF" busyLabel="Preparing…" busy={downloading} />
      </button>
    </header>
  );
}
