'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import { iconButton } from '@/ui/iconButton';
import { Briefcase01, XClose, Zap } from '@/ui/lineIcons';

import { FigureEditor } from './FigureEditor';

type Bullet = NonNullable<PlanStep['bullet']>;

/** A job's line as quoted: without the list mark the listing gave it ("- Strong Figma …"). */
export const quoteOf = (need: string) => need.replace(/^[\s\-–—•*]+/, '');

/** The dialogs' shared head: a tile, the question, one line under it, and a close button. */
function Head({ icon, title, line }: { icon: ReactNode; title: string; line: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-text-brand"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <DialogTitle className="text-h2 font-bold text-text-primary">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-body-m text-text-secondary">
          {line}
        </DialogDescription>
      </div>
      <DialogClose
        aria-label="Close"
        className={cn(iconButton, '-mr-1 -mt-1 ml-auto')}
      >
        <XClose aria-hidden className="size-5 text-text-tertiary" />
      </DialogClose>
    </div>
  );
}

const row =
  'flex min-h-control-lg cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors duration-fast ease-standard has-focus-visible:outline-2 has-focus-visible:outline-brand-600';

/**
 * "Where did you use Git?" (owner, 2026-11-14: user input in a proper pop-up): the resume's own
 * roles and projects to tick, several at once, or Skills only, which counts half. Each tick counts
 * the moment it is made; Done only closes.
 */
export function PlaceDialog({
  open,
  onOpenChange,
  keyword,
  need,
  places,
  where,
  onToggle,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  /** The job's own line that asks for it. */
  need?: string | undefined;
  places: readonly TailorPlace[];
  where: readonly string[] | undefined;
  onToggle: (where: string, on: boolean) => void;
  onClear: () => void;
}) {
  const none = !where?.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="md">
      <div className="flex min-h-0 flex-col gap-4 px-6 pb-5 pt-6">
        <Head
          icon={<Briefcase01 className="size-5" />}
          title={`Where did you use ${keyword}?`}
          line={
            need
              ? `The job asks for it: “${quoteOf(need)}” Tick every role or project that really shows it.`
              : 'Tick every role or project that really shows it.'
          }
        />
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {places.map((place) => {
            const on = where?.includes(place.id) ?? false;
            return (
              <li key={place.id}>
                <label
                  className={cn(
                    row,
                    on
                      ? 'border-border-brand-strong bg-surface-brand'
                      : 'border-border-default hover:bg-neutral-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onToggle(place.id, e.target.checked)}
                    className="size-4 shrink-0 accent-brand-600 outline-none"
                  />
                  <span className="min-w-0 flex-1 text-body-l font-medium text-text-primary">
                    {place.label}
                  </span>
                </label>
              </li>
            );
          })}
          <li>
            <label
              className={cn(
                row,
                none
                  ? 'border-border-brand-strong bg-surface-brand'
                  : 'border-border-default hover:bg-neutral-50',
              )}
            >
              <input
                type="checkbox"
                checked={none}
                onChange={() => !none && onClear()}
                className="size-4 shrink-0 accent-brand-600 outline-none"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-body-l font-medium text-text-primary">Skills only</span>
                <span className="block text-body-s font-medium text-text-tertiary">
                  Listed in Skills, not in a role. It counts half.
                </span>
              </span>
            </label>
          </li>
        </ul>
      </div>
      <div className="flex justify-end border-t border-border-default px-5 py-3.5">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={buttonClass({ size: 'lg' })}
        >
          Done
        </button>
      </div>
    </Dialog>
  );
}

/**
 * "Add the result" in a pop-up (owner, 2026-11-14): the line as it stands, then what improved and
 * by about how much, or a typed result. Using the line or keeping the original closes it.
 */
export function ResultDialog({
  open,
  onOpenChange,
  resumeId,
  bullet,
  saved,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
  bullet: Bullet;
  saved: string | undefined;
  onSave: (text: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-6">
        <Head
          icon={<Zap className="size-5" />}
          title={saved ? 'Edit your result' : 'Add the result'}
          line="Say what came of this line, and the AI writes it in."
        />
        <blockquote className="rounded-lg border-l-4 border-border-brand-strong bg-neutral-50 px-4 py-3 text-body-m text-text-secondary">
          {bullet.text}
        </blockquote>
        <FigureEditor
          open={open}
          resumeId={resumeId}
          bullet={bullet}
          saved={saved}
          onSave={onSave}
          onDone={() => onOpenChange(false)}
        />
      </div>
    </Dialog>
  );
}
