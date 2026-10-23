import type { ReactNode } from 'react';

/**
 * One labelled line of a Preferences card (356:22-84, 356:99-142): the name in a fixed column and
 * its control filling the rest. The column is 160px, the board's 176 less enough that the time
 * zone isn't cut off at 1396 with the sidebar open; "Minimum salary (optional)" (155px) still
 * holds one line. Each control carries the name for assistive tech itself.
 */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-4 py-2">
      <span className="w-40 shrink-0 text-body-m text-text-primary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}
