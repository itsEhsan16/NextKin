'use client';

import type { Job, TailorRun } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { Check, ChevronRight, Minus } from '@/ui/lineIcons';

import { changeLines } from '../tailorLibrary';

/**
 * "What changed for this job" (734:2033; redesign R5d, audit TL-43): what the run did to the
 * resume, then what it left out and why, so the review says what was edited before anyone reads
 * the page. Closed by default, because the review is a fixed-height workspace and the assistant
 * below it needs the room; the summary line still gives the count.
 */
export function ChangeLog({ job, run }: { job: Job; run: TailorRun }) {
  const lines = changeLines(job, run);
  if (!lines.length) return null;
  const made = lines.filter((line) => !line.left).length;
  return (
    <details className={cn(cardSurface, 'group shrink-0 px-5 py-4')}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-body-m font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
        What changed for this job
        <span className="text-body-s font-medium text-text-tertiary">
          {made} {made === 1 ? 'change' : 'changes'}
        </span>
        <ChevronRight
          aria-hidden
          className="ml-auto size-4 text-text-tertiary transition-transform duration-fast ease-standard group-open:rotate-90"
        />
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.label}
            className={cn(
              'flex items-start gap-2 text-body-s',
              line.left ? 'text-text-tertiary' : 'text-text-secondary',
            )}
          >
            {line.left ? (
              <Minus aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-feedback-success-icon" />
            )}
            {line.label}
          </li>
        ))}
      </ul>
    </details>
  );
}
