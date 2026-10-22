'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon, TrashIcon } from '@/ui/icons';
import { ArrowUp } from '@/ui/lineIcons';
import { cn } from '@/lib/cn';
import { onReveal } from '../reveal';
import { removeButton, toolButton, toolIcon } from './controls';

/**
 * One entry of a section — a role, a school, a project (EDIT 01, 866:276). Closed, a white row
 * with the line the page prints; open, a tinted card holding the form. It can move within its section or go (Undo brings
 * it back).
 */
export function EntryCard({
  entryId,
  title,
  subtitle,
  kind,
  index,
  count,
  onMove,
  onRemove,
  defaultOpen = false,
  flagged = false,
  children,
}: {
  /** Opens it when the download checklist points here. */
  entryId?: string;
  title: string;
  subtitle?: string;
  kind: string;
  index: number;
  count: number;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  defaultOpen?: boolean;
  flagged?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  useEffect(
    () => onReveal((t) => entryId !== undefined && t.entryId === entryId && setOpen(true)),
    [entryId],
  );
  const name = title.trim() || `New ${kind.toLowerCase()}`;
  return (
    <div
      className={cn(
        'rounded-xl border border-border-default transition-colors duration-press ease-standard',
        open ? 'bg-neutral-50' : 'bg-surface-card hover:border-neutral-400',
      )}
    >
      <div className="flex items-center gap-1 py-1.5 pl-3.5 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <ChevronDownIcon
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-text-tertiary transition-transform duration-base ease-standard',
              open ? 'rotate-0' : '-rotate-90',
            )}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-body-l',
                open ? 'font-bold' : 'font-semibold',
                title.trim() ? 'text-text-primary' : 'text-text-tertiary',
              )}
            >
              {name}
            </span>
            {subtitle?.trim() && (
              <span className="block truncate text-caption-m text-text-tertiary">{subtitle}</span>
            )}
          </span>
          {flagged && (
            <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-caption-m font-semibold text-warning-text">
              Needs details
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={`Move ${name} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className={toolButton}
        >
          <ArrowUp aria-hidden className={toolIcon} />
        </button>
        <button
          type="button"
          aria-label={`Move ${name} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className={toolButton}
        >
          <ArrowUp aria-hidden className={cn(toolIcon, 'rotate-180')} />
        </button>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className={removeButton}
        >
          <TrashIcon aria-hidden className={toolIcon} />
        </button>
      </div>
      <CollapseFade open={open} axis="vertical" inert={!open}>
        <div id={bodyId} className="flex flex-col gap-3 px-3.5 pb-3.5 pt-1">
          {children}
        </div>
      </CollapseFade>
    </div>
  );
}
