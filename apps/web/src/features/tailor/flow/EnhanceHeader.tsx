'use client';

import { ATS_BAND_LABEL, atsBandFor, type Job, type Resume } from '@nextkin/shared/models';

import { DocTile } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { ScoreRing } from '@/ui/ScoreRing';

import { Entity, JobLogoTile, jobTitleOf } from './EntityRow';

const RING = { strong: 'success', good: 'success', fair: 'warning', weak: 'danger' } as const;
const PILL = {
  strong: 'bg-success-surface text-success-text',
  good: 'bg-success-surface text-success-text',
  fair: 'bg-warning-50 text-warning-text',
  weak: 'bg-danger-50 text-danger-text',
} as const;

/**
 * The top of Enhance, now the one step after picking a resume (owner, 2026-11-02, toreview §149):
 * the job against the resume, with Change, and the ATS score as it stands. What the choices below
 * add is said in the right column, so this stays one row.
 */
export function EnhanceHeader({
  job,
  resume,
  onChangeResume,
  score,
  scored,
}: {
  job: Job;
  resume: Resume | undefined;
  onChangeResume: () => void;
  score: number;
  scored: boolean;
}) {
  const band = atsBandFor(score);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-8 pt-5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <Entity lead={<JobLogoTile job={job} />} label="The job" title={jobTitleOf(job)} />
        <span className="text-body-m font-semibold text-neutral-400">vs</span>
        <Entity
          lead={<DocTile small />}
          label="Your resume"
          title={resume ? `${resume.title}${resume.isBase ? ' (base)' : ''}` : 'Your resume'}
        />
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onChangeResume}
          className="h-8 rounded-md border border-border-default bg-surface-card px-3 text-body-m font-semibold text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Change
        </button>
      </div>
      {scored && (
        <div className="flex items-center gap-3">
          <ScoreRing score={score} label="Out of 10" name="ATS score" outOf10 tone={RING[band]} />
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-caption-m font-semibold', PILL[band])}
          >
            ATS score now · {ATS_BAND_LABEL[band]}
          </span>
        </div>
      )}
    </div>
  );
}
