'use client';

import type { DocLine } from '@nextkin/shared/models';
import { useEffect, useRef, useState } from 'react';

import { DragIcon, PlusIcon, TrashIcon } from '@/ui/icons';

import { blankLine, move } from '../editorModel';
import { cn } from '@/lib/cn';
import { removeButton, toolButton, toolIcon } from './controls';

/**
 * Bullets as a list of lines (toreview §124). Enter starts a new bullet under this one, Backspace
 * on an empty one removes it and goes back up. Each line is a box with a handle — drag it, or use
 * the arrow keys on it — and a bin (EDIT 01, 866:315). A line keeps its id
 * while it is edited, so an unchanged line keeps the evidence it was written with.
 */
export function BulletList({
  label,
  lines,
  onChange,
  max = 12,
  placeholder = 'What you did, and what came of it — a number helps',
}: {
  label: string;
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusNext = useRef<string | null>(null);
  const dragging = useRef<number | null>(null);
  // The line whose handle is held: only it can be dragged, so text in a line still selects.
  const [grab, setGrab] = useState<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    refs.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const set = (index: number, text: string) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, text } : l)));
  const insertAfter = (index: number) => {
    if (lines.length >= max) return;
    const line = blankLine();
    focusNext.current = line.id;
    onChange([...lines.slice(0, index + 1), line, ...lines.slice(index + 1)]);
  };
  const remove = (index: number) => {
    const previous = lines[index - 1];
    if (previous) focusNext.current = previous.id;
    onChange(lines.filter((_, i) => i !== index));
  };

  const drop = (to: number) => {
    const from = dragging.current;
    dragging.current = null;
    if (from == null || from === to) return;
    const next = [...lines];
    const [line] = next.splice(from, 1);
    if (line) next.splice(to, 0, line);
    onChange(next);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-body-m font-semibold text-text-primary">{label}</legend>
      {lines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <li
              key={line.id}
              draggable={grab === line.id}
              onDragStart={() => (dragging.current = index)}
              onDragEnd={() => setGrab(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                drop(index);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-card py-1 pl-1.5 pr-1 transition-colors duration-press ease-standard focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 hover:border-neutral-400"
            >
              <button
                type="button"
                aria-label={`Move line ${index + 1}: drag, or use the arrow keys`}
                onPointerDown={() => setGrab(line.id)}
                onPointerUp={() => setGrab(null)}
                onKeyDown={(event) => {
                  const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                  if (!by || index + by < 0 || index + by >= lines.length) return;
                  event.preventDefault();
                  onChange(move(lines, index, by));
                }}
                className={cn(toolButton, 'cursor-grab text-neutral-400 active:cursor-grabbing')}
              >
                <DragIcon aria-hidden className={toolIcon} />
              </button>
              <textarea
                ref={(node) => {
                  if (node) refs.current.set(line.id, node);
                  else refs.current.delete(line.id);
                }}
                rows={1}
                maxLength={600}
                value={line.text}
                aria-label={`${label}, line ${index + 1}`}
                placeholder={placeholder}
                onChange={(event) => set(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    insertAfter(index);
                  } else if (event.key === 'Backspace' && line.text === '' && lines.length > 0) {
                    event.preventDefault();
                    remove(index);
                  }
                }}
                className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body-m leading-snug text-text-primary outline-none [field-sizing:content] placeholder:text-text-tertiary"
              />
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => remove(index)}
                className={removeButton}
              >
                <TrashIcon aria-hidden className={toolIcon} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={lines.length >= max}
        onClick={() => insertAfter(lines.length - 1)}
        className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-body-m font-semibold text-text-brand transition-colors duration-press ease-standard hover:bg-surface-brand disabled:text-text-tertiary focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <PlusIcon aria-hidden className="size-3.5" />
        {lines.length >= max ? `Up to ${max} lines` : 'Add a line'}
      </button>
    </fieldset>
  );
}
