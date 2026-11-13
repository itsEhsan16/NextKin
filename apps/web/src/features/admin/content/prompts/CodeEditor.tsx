'use client';

import { Fragment } from 'react';

import { cn } from '@/lib/cn';

const VARIABLE = /(\{\{[^}]+\}\})/g;

/** The distinct `{{variables}}` a prompt uses. */
export const variablesIn = (text: string): string[] => [...new Set(text.match(VARIABLE) ?? [])];

/**
 * A line with its `{{variables}}` drawn as the board's chips (407:3388): medium indigo on the
 * brand wash, a 1px brand-100 border, radius 4, 22px tall. The chip's padding and border are
 * cancelled by negative margins, and its tracking evens out the medium weight, so each variable
 * takes the same width as the plain text in the textarea above and the caret stays aligned. The
 * padding is 2px, not the board's 4: a chip reaches into the spaces beside it, and a space is
 * only about 3.5px wide.
 */
function Highlighted({ line }: { line: string }) {
  return (
    <>
      {line.split(VARIABLE).map((part, index) =>
        part.startsWith('{{') ? (
          <span
            key={index}
            className="-mx-[3px] inline-block rounded-tag border border-brand-100 bg-brand-50 px-0.5 font-medium leading-[20px] tracking-title text-brand-700"
          >
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The prompt editor's code block (Figma 407:3141): numbered lines with the template variables
 * picked out in indigo. When editable, a transparent textarea sits exactly over the drawn text,
 * so typing gets the browser's own editing (selection, undo, IME) while the highlight stays.
 * Lines don't wrap; a long one scrolls sideways with the block. Every line is 26px, the board's
 * plain line; its chip lines are 28, which a textarea's single line height can't follow.
 */
export function CodeEditor({
  value,
  onChange,
  label,
  readOnly,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  readOnly: boolean;
  onBlur?: () => void;
}) {
  const lines = value.split('\n');
  return (
    <div className="flex min-h-[200px] gap-4 rounded-md border border-neutral-200 bg-neutral-50 py-3 pl-3 pr-4 focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100">
      <ol
        aria-hidden
        className="w-6 shrink-0 select-none text-right text-body-s leading-[26px] text-neutral-400"
      >
        {lines.map((_, index) => (
          <li key={index}>{index + 1}</li>
        ))}
      </ol>
      {/* The 3px inset leaves room for a chip at the start of a line, which reaches 3px out. */}
      <div className="-ml-[3px] min-w-0 flex-1 overflow-x-auto pl-[3px]">
        <div className="relative inline-block min-w-full">
          <pre
            aria-hidden
            className="m-0 whitespace-pre font-sans text-body-s leading-[26px] text-neutral-800"
          >
            {lines.map((line, index) => (
              <div key={index}>
                <Highlighted line={line} />
                {'​'}
              </div>
            ))}
          </pre>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
            aria-label={label}
            spellCheck={false}
            wrap="off"
            className={cn(
              'absolute inset-0 size-full resize-none overflow-hidden whitespace-pre bg-transparent font-sans text-body-s leading-[26px] text-transparent outline-none selection:bg-brand-200/60',
              readOnly ? 'cursor-default caret-transparent' : 'caret-neutral-900',
            )}
          />
        </div>
      </div>
    </div>
  );
}

type DiffLine = { kind: 'same' | 'add' | 'remove'; text: string };

/** A line diff by longest common subsequence: enough for prompts of a few dozen lines. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push({ kind: 'remove', text: a[i]! });
      i += 1;
    } else {
      out.push({ kind: 'add', text: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) out.push({ kind: 'remove', text: a[i++]! });
  while (j < b.length) out.push({ kind: 'add', text: b[j++]! });
  return out;
}

/** The diff, drawn as the KB review's field changes are: removed on red, added on green. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = diffLines(before, after);
  const changed = lines.some((l) => l.kind !== 'same');
  if (!changed) {
    return <p className="text-body-s text-text-secondary">No changes against the live version.</p>;
  }
  return (
    <ol className="max-h-[420px] overflow-auto rounded-md border border-neutral-200 py-2 text-body-s leading-[20px]">
      {lines.map((line, index) => (
        <li
          key={index}
          className={cn(
            'flex gap-3 whitespace-pre px-3',
            line.kind === 'add' && 'bg-success-50 text-success-text',
            line.kind === 'remove' &&
              'bg-danger-50 text-danger-text line-through decoration-danger-600/40',
            line.kind === 'same' && 'text-text-secondary',
          )}
        >
          <span aria-hidden className="w-3 shrink-0 select-none">
            {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ''}
          </span>
          <span className="sr-only">
            {line.kind === 'add' ? 'Added: ' : line.kind === 'remove' ? 'Removed: ' : ''}
          </span>
          {line.text || '​'}
        </li>
      ))}
    </ol>
  );
}
