import type { ReactNode } from 'react';

/**
 * The bordered label-and-value rows inside a Settings card: Account information's four (254:495)
 * and Password's "Last changed" (254:534). The board sets the second a size up and in one colour;
 * here both read alike, the label weighted over its value as in the first. Renders a `<dl>`.
 */
export function InfoList({ children }: { children: ReactNode }) {
  return (
    <dl className="mt-3 divide-y divide-border-faint rounded-sm border border-border-card">
      {children}
    </dl>
  );
}

export type InfoRowProps = {
  label: string;
  /** What ends the row after the value: the chevrons on Phone number and Location (254:514). */
  trailing?: ReactNode;
  children: ReactNode;
};

export function InfoRow({ label, trailing, children }: InfoRowProps) {
  return (
    <div className="flex min-h-9 items-center gap-3 px-3">
      <dt className="w-40 shrink-0 text-body-m font-medium text-text-primary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-3 text-body-m text-text-secondary">
        {children}
        {trailing}
      </dd>
    </div>
  );
}
