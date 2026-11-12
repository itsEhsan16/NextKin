'use client';

import type { Job } from '@nextkin/shared/models';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';

import { BulletList } from './BulletList';

export type JobOverviewTabProps = { job: Job };

const HEADING = 'text-title-l font-bold text-neutral-800';

/**
 * "Job description" + "Key responsibilities" (304:2734-2755). The board's own empty space
 * between "Show more" and the AI callout, with the description already rendering at its full,
 * untruncated height, rules out "Show more = truncated description" — this reveals a
 * "Requirements" section from `job.requirements` instead, the one field the rest of the panel
 * has nowhere to show. Inferred, not literal — see `toreview.md`.
 */
export function JobOverviewTab({ job }: JobOverviewTabProps) {
  const [expanded, setExpanded] = useState(false);
  // Perks are the short tags of the same benefits: they stand in only without a full list.
  const benefits = job.benefits?.length ? job.benefits : (job.perks ?? []);

  return (
    <div>
      <h3 className={HEADING}>Job description</h3>
      <p className="mt-1.5 text-prose text-text-secondary">{job.description}</p>

      <h3 className={cn(HEADING, 'mt-4')}>Key responsibilities</h3>
      <BulletList items={job.responsibilities} className="mt-1.5" />

      <CollapseFade axis="vertical" open={expanded} inert={!expanded}>
        <h3 className={cn(HEADING, 'pt-4')}>Requirements</h3>
        <BulletList items={job.requirements} className="mt-1.5" />
        {benefits.length > 0 && (
          <>
            <h3 className={cn(HEADING, 'pt-4')}>Benefits</h3>
            <BulletList items={benefits} className="mt-1.5" />
          </>
        )}
      </CollapseFade>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="mt-2 flex items-center gap-1 text-body-l font-semibold text-brand-600 transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {expanded ? 'Show less' : 'Show more'}
        {/* Drawn pointing down, the board's "reveal more below"; turned over for "Show less". */}
        <ChevronDownIcon
          className={cn(
            'size-4 transition-transform duration-base ease-standard',
            expanded && 'rotate-180',
          )}
        />
      </button>
    </div>
  );
}
