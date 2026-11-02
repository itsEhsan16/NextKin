'use client';

import type { BuildComparison, Job } from '@nextkin/shared/models';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { ProfileAccountIllustration } from '@/ui/illustrations';
import { AlertTriangle, CheckCircle } from '@/ui/lineIcons';
import { ScoreRing } from '@/ui/ScoreRing';
import { textLink } from '@/ui/textLink';

import { Entity, JobLogoTile, jobTitleOf } from './EntityRow';

/**
 * The top of Build's Enhance, now the one step after the job (owner, 2026-11-02, toreview §149): the
 * job against the profile, and how much of it the profile covers. Was step 3's header.
 */
export function BuildHeader({ job, comparison }: { job: Job; comparison: BuildComparison }) {
  const tone = comparison.score >= 70 ? 'success' : comparison.score >= 40 ? 'warning' : 'danger';
  const missing = comparison.keywords.filter((k) => !k.onResume).length;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-8 pt-5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <Entity lead={<JobLogoTile job={job} />} label="The job" title={jobTitleOf(job)} />
        <span className="text-body-m font-semibold text-neutral-400">vs</span>
        <Entity
          lead={<ProfileAccountIllustration aria-hidden className="h-auto w-8" />}
          label="Built from"
          title="Your profile"
        />
      </div>
      <div className="flex items-center gap-3">
        <ScoreRing score={comparison.score} label="Job match" size={64} suffix="%" tone={tone} />
        <span className="max-w-48 text-body-m font-semibold text-text-primary">
          {missing === 0
            ? 'Your profile covers every keyword'
            : `${missing} ${missing === 1 ? 'keyword' : 'keywords'} missing`}
        </span>
      </div>
    </div>
  );
}

/** "What the build improves", folded away like the tailor flow's full plan. */
export function BuildImprovements({ comparison }: { comparison: BuildComparison }) {
  const [open, setOpen] = useState(false);
  if (comparison.improvements.length === 0) return null;
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(textLink, 'mx-8 my-4 flex items-center gap-1.5 text-body-m text-text-brand')}
      >
        {open ? 'Hide what the build improves' : 'See what the build improves'}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-press ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      <CollapseFade axis="vertical" open={open}>
        <ul className="flex flex-col gap-2.5 px-8 pb-8">
          {comparison.improvements.map((row) => (
            <li key={row.key} className="flex items-start gap-3 rounded-md bg-neutral-50 px-4 py-3">
              {row.ok ? (
                <CheckCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
              )}
              <span className="min-w-0">
                <span className="block text-body-l font-bold text-text-primary">{row.label}</span>
                <span className="block text-body-m text-text-secondary">{row.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </CollapseFade>
    </div>
  );
}
