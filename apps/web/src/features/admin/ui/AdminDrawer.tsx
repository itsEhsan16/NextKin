'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { CloseButton } from './AdminDialog';
import { useReturnFocus } from './useReturnFocus';

export type AdminDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Beside the title: a status badge ("● Open"). */
  badge?: ReactNode;
  /** The line under the title: "Tailor · user ···9c10 · failed 38 min ago". */
  subtitle?: ReactNode;
  children: ReactNode;
  /** The foot: a note on the left ("Both actions are audited") and the actions on the right. */
  footerNote?: ReactNode;
  actions?: ReactNode;
};

/**
 * The admin boards' side panel (Generation failures, Figma 406:1691): 560px from the right edge,
 * full height, a header with the title, a badge and a line under it, a scrolling body, and a
 * footer of actions. It is a dialog (Radix): focus is trapped, Escape and the dimmed page close
 * it.
 */
export function AdminDrawer({
  open,
  onOpenChange,
  title,
  badge,
  subtitle,
  children,
  footerNote,
  actions,
}: AdminDrawerProps) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-neutral-900/40 data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus}
          className="fixed inset-y-0 right-0 z-modal flex w-[min(560px,100vw)] flex-col bg-surface-card shadow-modal outline-none data-[state=open]:animate-drawer-in"
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-neutral-200 py-5 pl-6 pr-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <Dialog.Title className="truncate text-h2 font-semibold tracking-snug text-text-primary">
                  {title}
                </Dialog.Title>
                {badge}
              </div>
              {subtitle != null && <p className="text-body-s text-text-secondary">{subtitle}</p>}
            </div>
            <CloseButton />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {children}
          </div>
          {(footerNote != null || actions != null) && (
            <div className="flex shrink-0 items-center gap-3 border-t border-neutral-200 px-6 py-4">
              {footerNote != null && (
                <p className="text-body-s text-text-secondary">{footerNote}</p>
              )}
              <span className="flex-1" />
              {actions}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A section heading inside a drawer or detail card: "Stages", "Error", "Run details". */
export function PanelHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-body-s font-semibold text-text-primary">{children}</h3>;
}

/** Label-value rows with a slate rule between them (Figma 406:1777): the label 160px wide. */
export function DetailList({
  rows,
  labelWidth = 'w-40',
}: {
  rows: { label: string; value: ReactNode }[];
  /** The label column: 160px in a drawer (406:1777); narrower in a side card. */
  labelWidth?: 'w-40' | 'w-28' | 'w-24';
}) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center gap-4 border-b border-neutral-100 py-3 last:border-b-0"
        >
          <dt className={`${labelWidth} shrink-0 text-body-s font-medium text-text-secondary`}>
            {row.label}
          </dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body-s text-text-primary">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
