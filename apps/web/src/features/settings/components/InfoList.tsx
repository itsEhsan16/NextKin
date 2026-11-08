import type { ReactNode } from 'react';

/**
 * The list inside a Settings card (toreview §132): rows run edge to edge under the card's header,
 * a hairline between each, and the last one closes the card instead of sitting in a second box.
 */
export const settingsList =
  '-mx-6 mt-5 divide-y divide-border-subtle border-t border-border-subtle not-last:border-b last:-mb-6';

/** One row of that list: 56px at least, inset to the card's own padding. */
export const settingsRow = 'min-h-14 px-6 py-3';

/**
 * The bordered label-and-value rows inside a Settings card: Account information's four (254:495)
 * and Password's "Last changed" (254:534). The board sets the second a size up and in one colour;
 * here both read alike, the label weighted over its value as in the first. Renders a `<dl>`.
 */
export function InfoList({ children }: { children: ReactNode }) {
  return <dl className={settingsList}>{children}</dl>;
}

export type InfoRowProps = {
  label: string;
  /** What ends the row after the value: the chevrons on Phone number and Location (254:514). */
  trailing?: ReactNode;
  children: ReactNode;
};

export function InfoRow({ label, trailing, children }: InfoRowProps) {
  return (
    <div className={`flex items-center gap-3 ${settingsRow}`}>
      <dt className="w-44 shrink-0 text-body-m font-medium text-text-primary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-3 text-body-m text-text-secondary">
        {children}
        {trailing}
      </dd>
    </div>
  );
}
