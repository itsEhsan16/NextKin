import { cn } from '@/lib/cn';

/**
 * The one busy ring (toreview §131): a button working, a run's current step. It inherits the ink
 * it sits in. Decorative: the label beside it ("Saving…", "in progress") says what is happening.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-spinner
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}
