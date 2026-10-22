'use client';

import type { Route } from 'next';
import Link from 'next/link';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { RefreshIcon, WarningIcon } from '@/ui/icons';
import { JobSeekerBinocularsIllustration } from '@/ui/illustrations';
import { StatusPage } from '@/ui/StatusPage';

/**
 * SYS 06 (871:718): a link that leads nowhere. The reader stays in the app, with a way home and
 * a way to a person (`toreview.md` §85, §102).
 */
export function NotFoundScreen() {
  return (
    <StatusPage
      name="Not found"
      art={<JobSeekerBinocularsIllustration className="h-40 w-auto" />}
      heading="We couldn’t find that page"
      message="The link may be old, or the page may have moved."
      action={
        <Link href={'/' as Route} className={primaryButton}>
          Back to Home
        </Link>
      }
    />
  );
}

/**
 * SYS 07 (871:922): a page that crashed while rendering. The shell stays up, the reader is told
 * plainly, and "Try again" re-renders just this page.
 */
export function PageErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <StatusPage
      name="Something went wrong"
      alert
      art={
        <span className="flex size-17 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
          <WarningIcon className="size-8" />
        </span>
      }
      heading="Something went wrong on this page"
      message="Nothing you saved was lost. Try loading it again."
      action={
        <button type="button" onClick={onRetry} className={primaryButton}>
          <RefreshIcon aria-hidden className="size-4" />
          Try again
        </button>
      }
    />
  );
}
