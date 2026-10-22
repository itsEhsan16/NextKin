import { unreadableJdId } from '@nextkin/shared/queries';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { CollapseFade } from '@/ui/CollapseFade';
import { ArrowRight, Stars02, iconSize } from '@/ui/lineIcons';
import { Spinner } from '@/ui/Spinner';
import { StableLabel } from '@/ui/StableLabel';

import { jdHref } from '../../jd/jdHref';

export type AnalyzeButtonProps = {
  label: string;
  pending: boolean;
  disabled: boolean;
  /** The paste board's button leads with the sparkle (257:3099); the other two don't. */
  sparkle?: boolean;
  className?: string;
};

/**
 * Each tab's primary action: "Analyze Job Description", "Fetch & Analyze", "Upload & Analyze", with
 * the boards' trailing arrow. A submit button, so Enter in the link field sends it too.
 */
export function AnalyzeButton({
  label,
  pending,
  disabled,
  sparkle,
  className,
}: AnalyzeButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(
        brandButton,
        'h-control-lg shrink-0 gap-2 rounded-md px-5 text-body-l font-semibold',
        className,
      )}
    >
      {pending ? <Spinner /> : sparkle && <Stars02 aria-hidden className={iconSize.sm} />}
      {/* Keeps its width while it works, so the link field beside it doesn't resize. */}
      <StableLabel label={label} busyLabel="Analyzing…" busy={pending} />
      <ArrowRight aria-hidden className={iconSize.sm} />
    </button>
  );
}

export type AnalyzeStatusValue = 'idle' | 'pending' | 'error';

/**
 * Where an extraction's outcome shows. While it runs (and while its page opens), a line saying
 * so; a JD that is read opens its own page (toreview §110), so there is no success note here any
 * more. On failure, what went wrong and the way on: a JD that could not be read can have its
 * fields entered by hand (V2 §7.5); pressing the button again retries. `status` is 'idle' again
 * once the input no longer matches what was analysed, so a note never describes changed text.
 *
 * It grows in rather than pushing the buttons below it down in one frame, and its "reading" line
 * has the result box's padding, so the error takes its place without a jump (`toreview.md` §84).
 */
export function AnalyzeStatus(props: {
  status: AnalyzeStatusValue;
  error?: unknown;
  className?: string;
}) {
  if (props.status === 'idle') return null;
  return (
    <CollapseFade axis="vertical" open animateMount>
      <AnalyzeStatusBody {...props} />
    </CollapseFade>
  );
}

const NEXT =
  'rounded-sm font-semibold text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function AnalyzeStatusBody({
  status,
  error,
  className,
}: {
  status: AnalyzeStatusValue;
  error?: unknown;
  className?: string;
}) {
  if (status === 'pending') {
    return (
      <p
        role="status"
        className={cn('flex items-center gap-2 py-3 text-body-m text-text-secondary', className)}
      >
        <Spinner className="text-brand-600" />
        Reading the job description…
      </p>
    );
  }
  const manual = unreadableJdId(error);
  return (
    <p
      role="alert"
      className={cn('rounded-md bg-danger-50 px-4 py-3 text-body-m text-danger-600', className)}
    >
      {manual ? (
        <>
          We couldn’t read this as a job description.{' '}
          <Link href={jdHref(manual, { edit: true })} className={NEXT}>
            Enter the details yourself
          </Link>
        </>
      ) : (
        'We couldn’t read that job description. Check your connection and try again.'
      )}
    </p>
  );
}
