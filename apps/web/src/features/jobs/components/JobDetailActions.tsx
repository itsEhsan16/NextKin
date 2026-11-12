import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { JobAiSparkleIllustration } from '@/ui/illustrations';
import { ArrowRightIcon, ExternalLinkIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';

import { tailorHref } from '../jobPageLibrary';

export type JobDetailActionsProps = {
  onApply: () => void;
  applied: boolean;
  /** The job whose full page the second button opens (724:2). */
  jobId: string;
  /** Once applied, the button becomes the way to that application (`toreview.md` §102). */
  applicationHref?: Route;
};

/**
 * "Apply Now" + "View job details" (304:2772) — two `control-lg` halves. The board's "Save Job"
 * gave way to the job's full page (724:2) at the owner's word; the list card's bookmark still
 * saves (`toreview.md` §104). NextKin submits nothing, so Apply opens the employer's page and the
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
          className={cn(outlineButton, 'h-control-lg gap-2 rounded-md text-body-l font-semibold')}
        >
          View application
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onApply}
          disabled={applied}
          className={cn(brandButton, 'h-control-lg gap-2 rounded-md text-body-l font-semibold')}
        >
          {applied ? 'Applied' : 'Apply Now'}
          {!applied && <ExternalLinkIcon className="size-4" />}
        </button>
      )}
      {/* "View job details" went: the title already opens the job's page (audit JB-13). The
          panel's tailor action sits here instead of in a callout at the foot of the card. */}
      <Link
        href={tailorHref(jobId)}
        className={cn(
          brandOutlineButton,
          'h-control-lg gap-2 rounded-md text-body-l font-semibold',
        )}
      >
        <JobAiSparkleIllustration aria-hidden className="h-auto w-4 shrink-0" />
        Tailor resume
      </Link>
    </div>
  );
}
