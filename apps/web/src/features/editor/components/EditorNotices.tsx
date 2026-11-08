'use client';

import type { DocProblem } from '@nextkin/shared/scoring/resumeDocumentCheck';
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { HistoryIcon, SyncIcon } from '@/ui/icons';
import { AlertTriangle, ArrowRight } from '@/ui/lineIcons';
import { outlineButton } from '@/ui/outlineButton';

import type { EditorBackup } from '../editorBackup';
import { reveal } from '../reveal';
import { anchorOf } from './EditorForm';

/** The editor's banners (EDIT 03) and its download checklist (EDIT 02). */

const banner =
  'flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-xl border py-3 pl-4 pr-3 text-text-primary';
const bannerButton = 'h-9 rounded-lg px-3.5 text-body-m font-semibold';
const time = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

function BannerText({ icon, title, line }: { icon: ReactNode; title: string; line: string }) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-card"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-l font-bold">{title}</p>
        <p className="text-body-m font-medium text-text-secondary">{line}</p>
      </div>
    </>
  );
}

/** EDIT 03 (867:619): the editor opened with edits this browser kept that never reached us. */
export function RestoreBanner({
  backup,
  onRestore,
  onDiscard,
}: {
  backup: EditorBackup;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const at = new Date(backup.at);
  const when =
    at.toDateString() === new Date().toDateString()
      ? `at ${time(at)}`
      : `on ${at.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  return (
    <div role="status" className={cn(banner, 'border-border-brand bg-surface-brand')}>
      <BannerText
        icon={<HistoryIcon className="size-4 text-text-brand" />}
        title="Restore your unsaved changes?"
        line={`You made edits ${when} that weren’t saved — the tab closed before they reached us.`}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onDiscard} className={cn(outlineButton, bannerButton)}>
          Discard
        </button>
        <button type="button" onClick={onRestore} className={cn(brandButton, bannerButton)}>
          Restore
        </button>
      </div>
    </div>
  );
}

/**
 * EDIT 03 (867:630): a save was refused because a newer copy exists (412). Nothing is written over
 * it: the user copies their edits as text, then loads the latest and puts back what they need.
 */
export function ConflictBanner({
  onReload,
  onCopy,
  busy,
}: {
  onReload: () => void;
  onCopy: () => void;
  busy: boolean;
}) {
  return (
    <div role="alert" className={cn(banner, 'border-warning-text/30 bg-warning-50')}>
      <BannerText
        icon={<SyncIcon className="size-4 text-warning-text" />}
        title="This resume changed somewhere else"
        line="It was saved from another tab, your phone or a tailoring run, so your edits here can’t be saved over it."
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCopy}
          className={cn(outlineButton, bannerButton)}
        >
          Copy my edits
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReload}
          className={cn(brandButton, bannerButton)}
        >
          Load the latest
        </button>
      </div>
    </div>
  );
}

export function NoticeBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className={cn(banner, 'border-warning-text/30 bg-warning-50 text-body-m text-warning-text')}
    >
      {message}
    </div>
  );
}

/**
 * EDIT 02 (867:2), "A few things before you download": every problem under its section's name,
 * each one a jump that opens the field to fix.
 */
export function ProblemsDialog({
  open,
  problems,
  headingOf,
  onClose,
}: {
  open: boolean;
  problems: DocProblem[];
  headingOf: (section: DocProblem['section']) => string;
  onClose: () => void;
}) {
  const go = (problem: DocProblem) => {
    onClose();
    reveal({
      anchor: anchorOf(problem.section),
      ...(problem.entryId ? { entryId: problem.entryId } : {}),
    });
  };
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text-primary/40 data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-popover data-[state=closed]:pointer-events-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in">
          <div className="flex flex-col gap-4 px-6 pb-5 pt-6">
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-md bg-warning-50 text-warning-text"
              >
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-h2 font-bold text-text-primary">
                  A few things before you download
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-body-l text-text-secondary">
                  We can’t make the PDF until these are filled in. Each one opens its field.
                </Dialog.Description>
              </div>
            </div>
            <ul className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto">
              {problems.map((problem, i) => (
                <li key={`${problem.section}-${problem.entryId ?? ''}-${i}`}>
                  <button
                    type="button"
                    onClick={() => go(problem)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border-default px-4 py-3 text-left transition-colors duration-press ease-standard hover:border-border-brand hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-m font-medium text-text-tertiary">
                        {headingOf(problem.section)}
                      </span>
                      <span className="block text-body-l font-medium text-text-primary">
                        {problem.message}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-body-m font-semibold text-text-brand">
                      Go to it
                      <ArrowRight aria-hidden className="size-4.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end border-t border-border-default px-5 py-3.5">
            <button type="button" autoFocus onClick={onClose} className={primaryButton}>
              Keep editing
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
