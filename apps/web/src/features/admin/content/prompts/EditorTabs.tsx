'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

/** The id of the panel a tab controls, and of the tab that labels it. */
export const editorTabIds = (base: string, id: string) => ({
  tab: `${base}-tab-${id}`,
  panel: `${base}-panel-${id}`,
});

/**
 * The Editor card's tabs (Figma 407:3370): 36px tabs with 4px side padding, 20px apart, slate-500
 * until chosen and then indigo over a 2px underline, above the strip's 1px rule. Each tab
 * controls the editor's panel; arrow keys move between them.
 */
export function EditorTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  idBase,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = options.findIndex((o) => o.id === value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (at + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex items-end gap-5 border-b border-neutral-200"
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        const ids = editorTabIds(idBase, option.id);
        return (
          <button
            key={option.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-1 pb-3 pt-0.5 text-body-s font-semibold transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
              selected
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
