'use client';

import type { Route } from 'next';
import Link from 'next/link';

import { buttonClass } from '@/ui/Button';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/Dialog';
import { AiSparkIcon, ShieldCheckIcon } from '@/ui/icons';

export const ACCURACY_TITLE = 'Is everything here true?';
export const ACCURACY_MESSAGE =
  'Confirm every role, date, skill and number here is yours to claim. You can edit it first.';

/** The download dialogs' card (SYS 02, SYS 03). */
/**
 * SYS 02 (868:245): V2 §15 risk 2's accuracy confirmation, once per version, before its first
 * export. It pops up over the page when Download is pressed (owner, 2026-10-19). When the screen
 * knows what this version added (a tailored resume's ticked keywords), it lists them, since those
 * are the claims to check. Escape, the backdrop and "Not yet" all decline.
 *
 * Focus starts on "Not yet", so Enter never confirms a claim by reflex, and "Edit first" opens the
 * editor the message mentions (redesign R6b, audit RS-53, RS-54).
 */
export function AccuracyPrompt({
  open,
  onAnswer,
  added = [],
  editHref,
}: {
  open: boolean;
  /** The editor, for "Edit first". */
  editHref?: Route;
  onAnswer: (confirmed: boolean) => void;
  /** "Prototyping — in your Flipkart role": what this version added. */
  added?: readonly string[];
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onAnswer(false);
      }}
      size="md"
    >
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-text-brand"
        >
          <ShieldCheckIcon className="size-5" />
        </span>
        <DialogTitle className="text-h2 font-bold text-text-primary">{ACCURACY_TITLE}</DialogTitle>
        <DialogDescription className="text-body-l text-text-secondary">
          {ACCURACY_MESSAGE}
        </DialogDescription>
        {added.length > 0 && (
          <div className="rounded-lg bg-surface-subtle px-3 py-2.5">
            <p className="text-body-m font-medium text-text-tertiary">Added in this version</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {added.map((line) => (
                <li key={line} className="flex items-center gap-2 text-body-m text-text-primary">
                  <AiSparkIcon aria-hidden className="size-3.5 shrink-0 text-text-brand" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border-default px-4 py-3.5">
        {editHref && (
          <Link
            href={editHref}
            onClick={() => onAnswer(false)}
            className={buttonClass({ variant: 'ghost', size: 'lg' })}
          >
            Edit first
          </Link>
        )}
        <span className="flex-1" />
        <button
          type="button"
          autoFocus
          onClick={() => onAnswer(false)}
          className={buttonClass({ variant: 'secondary', size: 'lg' })}
        >
          Not yet
        </button>
        <button
          type="button"
          onClick={() => onAnswer(true)}
          className={buttonClass({ size: 'lg' })}
        >
          Yes, it’s accurate
        </button>
      </div>
    </Dialog>
  );
}
