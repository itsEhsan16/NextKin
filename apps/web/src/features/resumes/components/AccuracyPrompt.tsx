'use client';

import * as Dialog from '@radix-ui/react-dialog';

import { backButton, primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { AiSparkIcon, ShieldCheckIcon } from '@/ui/icons';

export const ACCURACY_TITLE = 'Is everything here true?';
export const ACCURACY_MESSAGE =
  'Confirm every role, date, skill and number here is yours to claim. You can edit it first.';

/** The download dialogs' card (SYS 02, SYS 03). */
export const promptDialog =
  'fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-popover data-[state=closed]:pointer-events-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in';

/**
 * SYS 02 (868:245): V2 §15 risk 2's accuracy confirmation, once per version, before its first
 * export. It pops up over the page when Download is pressed (owner, 2026-10-19). When the screen
 * knows what this version added (a tailored resume's ticked keywords), it lists them, since those
 * are the claims to check. Escape, the backdrop and "Not yet" all decline.
 */
export function AccuracyPrompt({
  open,
  onAnswer,
  added = [],
}: {
  open: boolean;
  onAnswer: (confirmed: boolean) => void;
  /** "Prototyping — in your Flipkart role": what this version added. */
  added?: readonly string[];
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onAnswer(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text-primary/40 data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out" />
        <Dialog.Content className={promptDialog}>
          <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-text-brand"
            >
              <ShieldCheckIcon className="size-5" />
            </span>
            <Dialog.Title className="text-h2 font-bold text-text-primary">
              {ACCURACY_TITLE}
            </Dialog.Title>
            <Dialog.Description className="text-body-l text-text-secondary">
              {ACCURACY_MESSAGE}
            </Dialog.Description>
            {added.length > 0 && (
              <div className="rounded-lg bg-neutral-50 px-3 py-2.5">
                <p className="text-body-m font-medium text-text-tertiary">Added in this version</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {added.map((line) => (
                    <li
                      key={line}
                      className="flex items-center gap-2 text-body-m text-text-primary"
                    >
                      <AiSparkIcon aria-hidden className="size-3.5 shrink-0 text-text-brand" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-border-default px-4 py-3.5">
            <button type="button" onClick={() => onAnswer(false)} className={backButton}>
              Not yet
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => onAnswer(true)}
              className={primaryButton}
            >
              Yes, it’s accurate
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
