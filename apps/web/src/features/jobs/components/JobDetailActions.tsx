import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { ArrowRightIcon, ExternalLinkIcon } from '@/ui/icons';

import { jobPageHref } from '../jobPageLibrary';

export type JobDetailActionsProps = {
  onApply: () => void;
  applied: boolean;
  /** The job whose full page "View Job" opens (724:2). */
  jobId: string;
  /** Once applied, the first button becomes the way to that application (`toreview.md` §102). */
  applicationHref?: Route;
};

const half = 'w-full';

/**
 * "Apply Now" + "View Job" (304:2772): two `lg` halves. The board's second button was "Save Job";
 * the owner asked for the job's full page there (2026-11-13), and saving moved to the ⋯ menu and
 * the list card's bookmark. NextKin submits nothing, so Apply opens the employer's page and the
 * app then asks whether they applied (owner, 2026-10-31).
 */
export function JobDetailActions({
  onApply,
  applied,
  jobId,
  applicationHref,
}: JobDetailActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {applied && applicationHref ? (
        <Link
          href={applicationHref}
          className={cn(buttonClass({ variant: 'secondary', size: 'lg' }), half)}
        >
          View application
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onApply}
          disabled={applied}
          className={cn(buttonClass({ size: 'lg' }), half)}
        >
          {applied ? 'Applied' : 'Apply Now'}
          {!applied && <ExternalLinkIcon aria-hidden className="size-4" />}
        </button>
      )}
      <Link
        href={jobPageHref(jobId)}
        className={cn(buttonClass({ variant: 'secondary', size: 'lg' }), half)}
      >
        View Job
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
