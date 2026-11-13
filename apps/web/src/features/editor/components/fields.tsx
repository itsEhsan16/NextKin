'use client';

import { useId, type ReactNode } from 'react';

import { fieldBox } from '@/ui/fieldBox';
import { cn } from '@/lib/cn';

/**
 * The editor's inputs (toreview §124), in the app's field box. Every field has a visible label
 * tied to its input; `hint` sits under it and is read with it.
 */

const label = 'text-body-m font-semibold text-text-primary';
const hintText = 'text-caption-m text-text-tertiary';

type Common = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
  maxLength?: number;
  invalid?: boolean;
  autoFocus?: boolean;
};

export function TextField({
  label: text,
  value,
  onChange,
  placeholder,
  hint,
  className,
  maxLength = 200,
  invalid,
  autoFocus,
  type = 'text',
}: Common & { type?: 'text' | 'email' | 'tel' | 'url' }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          fieldBox,
          'h-control-lg rounded-md px-3.5 text-body-m placeholder:text-text-tertiary',
          invalid && 'border-danger-600',
        )}
      />
      {hint && (
        <p id={`${id}-hint`} className={hintText}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label: text,
  value,
  onChange,
  placeholder,
  hint,
  className,
  maxLength = 2000,
  rows = 4,
}: Common & { rows?: number }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={label}>
          {text}
        </label>
        <span aria-hidden className={cn(hintText, 'tabular-nums')}>
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 resize-y rounded-md border border-border-default bg-surface-card px-3.5 py-3 text-body-m leading-relaxed text-text-primary transition-field duration-fast ease-standard placeholder:text-text-tertiary hover:border-neutral-400 focus-visible:border-border-selected focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      />
      {hint && (
        <p id={`${id}-hint`} className={hintText}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Two or three fields side by side on a wide panel, stacked on a narrow one. */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
