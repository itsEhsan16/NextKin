import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { ArrowRightIcon, ExternalLinkIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';

import { StableLabel } from '@/ui/StableLabel';

import { jobPageHref } from '../jobPageLibrary';

export type JobDetailActionsProps = {
  onApply: () => void;
  applying: boolean;
  applied: boolean;
  /** The job whose full page the second button opens (724:2). */
  jobId: string;
  /** Once applied, the button becomes the way to that application (`toreview.md` §102). */
  applicationHref?: Route;
};

/**
 * "Apply Now" + "View job details" (304:2772) — two `control-lg` halves. The board's "Save Job"
 * gave way to the job's full page (724:2) at the owner's word; the list card's bookmark still
 * saves (`toreview.md` §104). Apply calls the existing
 * `useApplyToJob()` mutation — in-app application recording, matching mobile's actual behaviour —
 * not an external redirect: the `Job` model has no `applyUrl` field, so the board's
 * external-link-style icon reads as a stylistic glyph, not a literal "opens outside the app"
 * requirement.
 */
export function JobDetailActions({
  onApply,
  applying,
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
          disabled={applying || applied}
          className={cn(brandButton, 'h-control-lg gap-2 rounded-md text-body-l font-semibold')}
        >
          {applied ? (
            'Applied'
          ) : (
            <StableLabel label="Apply Now" busyLabel="Applying…" busy={applying} />
          )}
          {!applied && <ExternalLinkIcon className="size-4" />}
        </button>
      )}
      <Link
        href={jobPageHref(jobId)}
        className={cn(outlineButton, 'h-control-lg gap-2 rounded-md text-body-l font-semibold')}
      >
        View job details
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
