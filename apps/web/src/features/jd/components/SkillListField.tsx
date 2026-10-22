'use client';

import { useId, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';
import { PlusIcon } from '@/ui/icons';
import { ArrowRight, XClose } from '@/ui/lineIcons';
import { pressable } from '@/ui/pressable';

const chipButton =
  'flex size-5 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-card hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600';

/**
 * A list of skills the user edits by hand (V2 §7.5's review): each a chip with its ×, typed in
 * one at a time, and, between the required and the nice-to-have lists, moved across with one
 * press. The chips are the Preferences fields' lavender (`ChipsField`), the box its border.
 */
export function SkillListField({
  label,
  values,
  onChange,
  move,
  placeholder = 'Add a skill',
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** "Move to nice-to-have": takes the chip out of this list for the caller to put elsewhere. */
  move?: { label: string; onMove: (value: string) => void };
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setDraft('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="flex min-h-control-lg w-full min-w-0 flex-wrap items-center gap-2.5 rounded-lg border border-border-default bg-surface-card p-2.5 transition-colors duration-press ease-standard focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 hover:border-neutral-400">
        {values.length > 0 && (
          <ul aria-label={label} className="contents">
            {values.map((value) => (
              <li
                key={value}
                className="flex items-center gap-1 rounded-md bg-neutral-100 py-1.5 pl-3 pr-1.5 text-body-l font-medium text-text-primary animate-pop-in"
              >
                {value}
                {move && (
                  <button
                    type="button"
                    aria-label={`${move.label}: ${value}`}
                    title={move.label}
                    onClick={() => move.onMove(value)}
                    className={chipButton}
                  >
                    <ArrowRight aria-hidden className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  className={chipButton}
                >
                  <XClose aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length ? 'Add' : placeholder}
          aria-label={`${label}: add one`}
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-body-l text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <button
          type="button"
          onClick={add}
          aria-label={`Add to ${label}`}
          disabled={!draft.trim()}
          className={cn(
            pressable,
            'flex size-7 items-center justify-center rounded-md text-text-brand enabled:hover:bg-surface-brand disabled:opacity-40',
            'focus-visible:outline-2 focus-visible:outline-brand-600',
          )}
        >
          <PlusIcon aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
