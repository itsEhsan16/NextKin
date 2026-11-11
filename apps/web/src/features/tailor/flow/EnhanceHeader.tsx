'use client';

import type { Job, Resume } from '@nextkin/shared/models';

import { DocTile } from '@/features/create/jobFlow/FlowRows';
import { ArrowRight } from '@/ui/lineIcons';

import { Entity, JobLogoTile, jobTitleOf } from './EntityRow';

const tile = 'flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-neutral-50 px-4 py-3';

/**
 * The top of "Choose keywords" (owner's mockup, 2026-11-11): the job's description → the resume
 * being tailored, with Change. The score sits in the right column now.
 */
export function EnhanceHeader({
  job,
  resume,
  onChangeResume,
}: {
  job: Job;
  resume: Resume | undefined;
  onChangeResume: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 @xl/main:flex-row @xl/main:items-center">
      <div className={tile}>
        <Entity lead={<JobLogoTile job={job} />} label="Job description" title={jobTitleOf(job)} />
      </div>
      <ArrowRight
        aria-hidden
        className="size-5 shrink-0 self-center text-text-tertiary rotate-90 @xl/main:rotate-0"
      />
      <div className={tile}>
        <span className="min-w-0 flex-1">
          <Entity
            lead={<DocTile small />}
            label="Your resume"
            title={resume ? `${resume.title}${resume.isBase ? ' (base)' : ''}` : 'Your resume'}
          />
        </span>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onChangeResume}
          className="h-control-sm shrink-0 rounded-md border border-border-default bg-surface-card px-3.5 text-body-m font-semibold text-text-primary transition-[border-color,scale] duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-(--scale-pressed)"
        >
          Change
        </button>
      </div>
    </div>
  );
}
