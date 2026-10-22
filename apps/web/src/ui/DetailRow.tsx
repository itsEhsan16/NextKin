import type { ReactNode } from 'react';

export type DetailRowProps = { icon: ReactNode; label: string; children: ReactNode };

/**
 * One label and value of a detail card (286:1593-1633): a glyph and a label in a fixed column,
 * the value beside it. The Applications card draws it; the Resumes card's undrawn Details tab
 * reuses it. Renders a `dt`/`dd` pair, so it sits inside a `<dl>`.
 */
export function DetailRow({ icon, label, children }: DetailRowProps) {
  return (
    <div className="flex min-h-7 items-center">
      <dt className="flex w-40 shrink-0 items-center gap-2.5 text-body-m text-text-tertiary">
        <span className="flex size-4 shrink-0 items-center justify-center text-neutral-400">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 text-body-m font-semibold text-neutral-800">{children}</dd>
    </div>
  );
}
