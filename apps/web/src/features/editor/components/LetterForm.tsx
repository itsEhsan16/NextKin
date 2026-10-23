'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { DragIcon, PlusIcon, TrashIcon } from '@/ui/icons';
import { ArrowUp } from '@/ui/lineIcons';

import { move } from '../editorModel';
import type { LetterDraft } from '../useLetterDraft';
import { removeButton, toolButton, toolIcon } from './controls';
import { FieldRow, TextField } from './fields';

/**
 * EDIT 04's form (867:636): the greeting, each paragraph in a box with a handle (drag it, or use
 * the arrow keys on it), move up, move down and a bin, then the sign-off and the name under it.
 * The letter stores the two as one sign-off, the closing line first.
 */

const MAX_PARAGRAPHS = 8;

export function LetterForm({
  draft,
  onEdit,
}: {
  draft: LetterDraft;
  onEdit: (patch: Partial<LetterDraft>, key: string) => void;
}) {
  const dragging = useRef<number | null>(null);
  const [grab, setGrab] = useState<number | null>(null);
  const { paragraphs } = draft;
  const [closing = '', ...rest] = draft.signoff.split('\n');
  const name = rest.join('\n');
  const setParagraphs = (next: string[], key = 'paragraphs') => onEdit({ paragraphs: next }, key);
  const drop = (to: number) => {
    const from = dragging.current;
    dragging.current = null;
    if (from == null || from === to) return;
    const next = [...paragraphs];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    setParagraphs(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Greeting"
        value={draft.greeting}
        onChange={(greeting) => onEdit({ greeting }, 'greeting')}
        placeholder="Dear Hiring Manager,"
      />
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-2 text-body-m font-semibold text-text-primary">Paragraphs</legend>
        {paragraphs.map((text, i) => (
          <div
            key={i}
            draggable={grab === i}
            onDragStart={() => (dragging.current = i)}
            onDragEnd={() => setGrab(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              drop(i);
            }}
            className="flex items-start gap-1.5 rounded-xl border border-border-default bg-surface-card py-2 pl-2 pr-1.5 transition-colors duration-press ease-standard hover:border-neutral-400 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600"
          >
            <button
              type="button"
              aria-label={`Move paragraph ${i + 1}: drag, or use the arrow keys`}
              onPointerDown={() => setGrab(i)}
              onPointerUp={() => setGrab(null)}
              onKeyDown={(event) => {
                const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                if (!by || i + by < 0 || i + by >= paragraphs.length) return;
                event.preventDefault();
                setParagraphs(move(paragraphs, i, by));
              }}
              className={cn(toolButton, 'cursor-grab text-neutral-400 active:cursor-grabbing')}
            >
              <DragIcon aria-hidden className={toolIcon} />
            </button>
            <textarea
              aria-label={`Paragraph ${i + 1}`}
              value={text}
              maxLength={900}
              rows={3}
              onChange={(event) =>
                setParagraphs(
                  paragraphs.map((q, j) => (j === i ? event.target.value : q)),
                  `paragraph.${i}`,
                )
              }
              className="min-h-24 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body-l leading-relaxed text-text-primary outline-none [field-sizing:content] placeholder:text-text-tertiary"
            />
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Move paragraph ${i + 1} up`}
                disabled={i === 0}
                onClick={() => setParagraphs(move(paragraphs, i, -1))}
                className={toolButton}
              >
                <ArrowUp aria-hidden className={toolIcon} />
              </button>
              <button
                type="button"
                aria-label={`Move paragraph ${i + 1} down`}
                disabled={i === paragraphs.length - 1}
                onClick={() => setParagraphs(move(paragraphs, i, 1))}
                className={toolButton}
              >
                <ArrowUp aria-hidden className={cn(toolIcon, 'rotate-180')} />
              </button>
              <button
                type="button"
                aria-label={`Remove paragraph ${i + 1}`}
                onClick={() => setParagraphs(paragraphs.filter((_, j) => j !== i))}
                className={removeButton}
              >
                <TrashIcon aria-hidden className={toolIcon} />
              </button>
            </div>
          </div>
        ))}
        {paragraphs.length < MAX_PARAGRAPHS && (
          <button
            type="button"
            onClick={() => setParagraphs([...paragraphs, ''])}
            className="flex h-8 items-center gap-1.5 self-start rounded-md px-1 text-body-m font-semibold text-text-brand transition-colors duration-press ease-standard hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <PlusIcon aria-hidden className="size-3.5" />
            Add a paragraph
          </button>
        )}
      </fieldset>
      <FieldRow>
        <TextField
          label="Sign-off"
          value={closing}
          onChange={(line) => onEdit({ signoff: [line, ...rest].join('\n') }, 'signoff')}
          placeholder="Kind regards,"
        />
        <TextField
          label="Name"
          value={name}
          maxLength={120}
          onChange={(next) => onEdit({ signoff: `${closing}\n${next}` }, 'signoff.name')}
          placeholder="Your name"
        />
      </FieldRow>
    </div>
  );
}
