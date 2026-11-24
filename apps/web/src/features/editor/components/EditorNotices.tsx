'use client';

import type { DocProblem } from '@nextkin/shared/scoring/resumeDocumentCheck';
import { Dialog, DialogHead, DialogHero, dialogBody, dialogFooter } from '@/ui/Dialog';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import {
  BriefcaseIcon,
  DocumentIcon,
  HistoryIcon,
  LayersIcon,
  PersonIcon,
  SchoolIcon,
  StarIcon,
  SyncIcon,
} from '@/ui/icons';
import { ArrowRight, File06 } from '@/ui/lineIcons';

import type { EditorBackup } from '../editorBackup';
import { formatClock } from '../formatClock';
import { reveal } from '../reveal';
import { anchorOf } from './EditorForm';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/** The editor's banners (EDIT 03) and its download checklist (EDIT 02). */

const banner =
  'flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-xl border py-3 pl-4 pr-3 text-text-primary';
// The control tokens' small height, not a hand-picked h-9 (redesign R6c, audit ED-35).
const bannerButton = 'h-control-sm rounded-lg px-3.5 text-body-m font-semibold';
const primaryButton = buttonClass({ size: 'lg' });

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
      ? `at ${formatClock(at)}`
      : `on ${at.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  return (
    <div role="status" className={cn(banner, 'border-border-brand bg-surface-brand')}>
      <BannerText
        icon={<HistoryIcon className="size-4 text-text-brand" />}
        title="Restore your unsaved changes?"
        line={`You made edits ${when} that weren’t saved — the tab closed before they reached us.`}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className={cn(BUTTON_VARIANT.secondary, bannerButton)}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onRestore}
          className={cn(BUTTON_VARIANT.primary, bannerButton)}
        >
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
          className={cn(BUTTON_VARIANT.secondary, bannerButton)}
        >
          Copy my edits
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReload}
          className={cn(BUTTON_VARIANT.primary, bannerButton)}
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

type SectionIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** Each problem's section as an icon, the same ones the profile uses for them. */
const SECTION_ICON: Record<string, SectionIcon> = {
  header: PersonIcon,
  summary: File06,
  skills: StarIcon,
  experience: BriefcaseIcon,
  projects: LayersIcon,
  education: SchoolIcon,
  certifications: DocumentIcon,
};

function SectionGlyph({ section }: { section: DocProblem['section'] }) {
  const Icon = SECTION_ICON[section] ?? File06;
  return <Icon aria-hidden className="size-6 shrink-0 text-text-brand" />;
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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} size="md">
      <DialogHero src="/illustrations/v2/download-blocked.webp" width={560} height={512} />
      <div className={cn(dialogBody, 'gap-4 pt-5')}>
        <DialogHead
          title="A few things before you download"
          line="We can’t make the PDF until these are filled in. Each one opens its field."
        />
        <ul className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto">
          {problems.map((problem, i) => (
            <li key={`${problem.section}-${problem.entryId ?? ''}-${i}`}>
              <button
                type="button"
                onClick={() => go(problem)}
                className="flex w-full items-center gap-4 rounded-xl border border-border-brand px-5 py-4 text-left transition-colors duration-press ease-standard hover:border-border-brand-strong hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <SectionGlyph section={problem.section} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-l font-bold text-text-primary">
                    {headingOf(problem.section)}
                  </span>
                  <span className="block text-body-m font-medium text-text-secondary">
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
      <div className={dialogFooter}>
        <button type="button" autoFocus onClick={onClose} className={primaryButton}>
          Keep editing
        </button>
      </div>
    </Dialog>
  );
}
