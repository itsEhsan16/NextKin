import { cn } from '@/lib/cn';

export type StableLabelProps = {
  /** What the button says normally. */
  label: string;
  /** What it says while it works: "Analyzing…", "Connecting…". */
  busyLabel: string;
  busy: boolean;
};

/**
 * A button label that swaps for its busy wording without the button changing width
 * (`toreview.md` §84). Both words sit in one grid cell, so the button is always as wide as the
 * longer of the two, and they cross-fade. Only the one showing is read out.
 */
export function StableLabel({ label, busyLabel, busy }: StableLabelProps) {
  return (
    <span className="inline-grid">
      <span
        aria-hidden={busy || undefined}
        className={cn(
          'col-start-1 row-start-1 transition-opacity duration-fast ease-standard',
          busy && 'opacity-0',
        )}
      >
        {label}
      </span>
      <span
        aria-hidden={!busy || undefined}
        className={cn(
          'col-start-1 row-start-1 transition-opacity duration-fast ease-standard',
          !busy && 'opacity-0',
        )}
      >
        {busyLabel}
      </span>
    </span>
  );
}
