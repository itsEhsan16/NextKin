'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

import { cardSurface } from '@/ui/Card';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon, TrashIcon } from '@/ui/icons';
import { ArrowUp, Edit03 } from '@/ui/lineIcons';
import { cn } from '@/lib/cn';
import { onReveal } from '../reveal';
import { removeButton, toolButton, toolIcon } from './controls';

/**
 * One section of the editor's form (EDIT 01, 866:259): its heading as the page prints it and a
 * count of what it holds, then move up, move down, rename and — for a section the user added —
 * remove. Open and closed like an accordion; `anchor` lets the download checklist jump to it.
 */
export function SectionCard({
  anchor,
  heading,
  defaultHeading,
  note,
  onRename,
  onMove,
  canMoveUp,
  canMoveDown,
  onRemove,
  defaultOpen = true,
  children,
}: {
  anchor: string;
  heading: string;
  defaultHeading?: string;
  note?: string;
  onRename?: (heading: string) => void;
  onMove?: (by: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onRemove?: () => void;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [renaming, setRenaming] = useState(false);
  const bodyId = useId();
  const headingId = useId();
  useEffect(() => onReveal((t) => t.anchor === anchor && setOpen(true)), [anchor]);

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      className={cn(cardSurface, 'scroll-mt-4 overflow-hidden rounded-xl shadow-card')}
    >
      <div className="flex items-center gap-2.5 py-2 pl-4.5 pr-2.5">
        {renaming && onRename ? (
          <input
            autoFocus
            aria-label="Section heading"
            maxLength={80}
            defaultValue={heading}
            placeholder={defaultHeading}
            onBlur={(event) => {
              onRename(event.target.value);
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape')
                (event.target as HTMLInputElement).blur();
            }}
            className="h-9 min-w-0 flex-1 rounded-md border border-border-brand px-2 text-title-l text-text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <ChevronDownIcon
              aria-hidden
              className={cn(
                'size-4 shrink-0 text-text-tertiary transition-transform duration-base ease-standard',
                open ? 'rotate-0' : '-rotate-90',
              )}
            />
            <span id={headingId} className="truncate text-title-l font-bold text-text-primary">
              {heading}
            </span>
            {note && (
              <span className="min-w-0 truncate text-body-m font-medium text-text-tertiary">
                {note}
              </span>
            )}
          </button>
        )}
        {onMove && (
          <>
            <button
              type="button"
              aria-label={`Move ${heading} up the page`}
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              className={toolButton}
            >
              <ArrowUp aria-hidden className={toolIcon} />
            </button>
            <button
              type="button"
              aria-label={`Move ${heading} down the page`}
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              className={toolButton}
            >
              <ArrowUp aria-hidden className={cn(toolIcon, 'rotate-180')} />
            </button>
          </>
        )}
        {onRename && !renaming && (
          <button
            type="button"
            aria-label={`Rename ${heading}`}
            onClick={() => setRenaming(true)}
            className={toolButton}
          >
            <Edit03 aria-hidden className={toolIcon} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove the ${heading} section`}
            onClick={onRemove}
            className={removeButton}
          >
            <TrashIcon aria-hidden className={toolIcon} />
          </button>
        )}
      </div>
      <CollapseFade open={open} axis="vertical" inert={!open}>
        <div
          id={bodyId}
          className="flex flex-col gap-3 border-t border-border-default px-4.5 pb-4 pt-3.5"
        >
          {children}
        </div>
      </CollapseFade>
    </section>
  );
}
