'use client';

import type { Job, Resume } from '@nextkin/shared/models';

import { DocTile } from '@/features/create/jobFlow/FlowRows';

import { AtsMatchCard } from './AtsMatchCard';
import { Entity, JobLogoTile, jobTitleOf } from './EntityRow';

/**
 * The top of Enhance, now the one step after picking a resume (owner, 2026-11-02, toreview §149):
 * the job against the resume, with Change, and the "ATS Match Score" card (owner's reference,
 * toreview §166): the score now and what the keywords ticked so far are estimated to add.
 */
export function EnhanceHeader({
  job,
  resume,
  onChangeResume,
  score,
  scored,
  gain,
  selected,
}: {
  job: Job;
  resume: Resume | undefined;
  onChangeResume: () => void;
  score: number;
  scored: boolean;
  /** What the user's own answers add, out of 10 (not the AI's own steps). */
  gain: number;
  selected: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-8 pt-5">
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
      {scored && <AtsMatchCard score={score} gain={gain} selected={selected} />}
    </div>
  );
}
