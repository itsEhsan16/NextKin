'use client';

import {
  useId,
  type ReactNode,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

/**
 * The admin boards' form pieces (Suspend dialog, Figma 407:2710): a 13px medium label with an
 * indigo asterisk when required, the control, and a 13px hint under it; a bordered radio group
 * whose chosen row takes the indigo wash; a checkbox row with a label and a line under it.
 */

const control =
  'w-full rounded-sm border border-neutral-300 bg-surface-card text-body-m text-text-primary shadow-xs outline-none transition-[border-color,box-shadow] duration-fast ease-standard placeholder:text-text-tertiary focus:border-border-selected focus:ring-4 focus:ring-brand-100 aria-invalid:border-danger-600 disabled:opacity-60';

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex gap-0.5 text-body-s font-medium text-neutral-700">
      {children}
      {required && (
        <span aria-hidden className="text-brand-600">
          *
        </span>
      )}
    </label>
  );
}

type FieldShell = { label: string; required?: boolean; hint?: ReactNode; error?: string };

function Shell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <p id={`${id}-hint`} role="alert" className="text-body-s text-danger-600">
          {error}
        </p>
      ) : (
        hint != null && (
          <p id={`${id}-hint`} className="text-body-s text-text-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** A one-line field at the boards' 44px. */
export function TextField({
  label,
  required,
  hint,
  error,
  className,
  ...input
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint != null || error ? `${id}-hint` : undefined}
        className={cn(control, 'h-11 px-3.5', className)}
        {...input}
      />
    </Shell>
  );
}

/** A note field (the Suspend dialog's internal note, 88px). */
export function TextArea({
  label,
  required,
  hint,
  error,
  className,
  ...area
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint != null || error ? `${id}-hint` : undefined}
        className={cn(control, 'min-h-[88px] resize-y py-2.5 pl-3.5 pr-3', className)}
        {...area}
      />
    </Shell>
  );
}

export type RadioOption<T extends string> = { id: T; label: string; description?: string };

/** One choice from a short list, each with a line saying what it means (Figma 407:2715). */
export function RadioCardGroup<T extends string>({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 flex gap-0.5 text-body-s font-medium text-neutral-700">
        {label}
        {required && (
          <span aria-hidden className="text-brand-600">
            *
          </span>
        )}
      </legend>
      <div className="flex flex-col overflow-hidden rounded-md border border-neutral-200">
        {options.map((option) => {
          const chosen = option.id === value;
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 border-b px-3.5 py-2.5 transition-colors duration-press ease-standard last:border-b-0 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-600',
                chosen
                  ? 'border-brand-100 bg-brand-50 text-brand-700'
                  : 'border-neutral-100 hover:bg-neutral-50',
              )}
            >
              <span className="relative mt-0.5 flex size-4 shrink-0">
                <input
                  type="radio"
                  name={name}
                  value={option.id}
                  checked={chosen}
                  required={required}
                  onChange={() => onChange(option.id)}
                  className="peer size-4 cursor-pointer appearance-none rounded-full border border-neutral-300 bg-surface-card transition-colors duration-press checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-none"
                />
                <span className="pointer-events-none absolute inset-0 m-auto size-1.5 rounded-full bg-text-inverse opacity-0 transition-opacity duration-press peer-checked:opacity-100" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col text-body-s">
                <span className={cn('font-medium', chosen ? 'text-brand-700' : 'text-neutral-700')}>
                  {option.label}
                </span>
                {option.description && (
                  <span className={chosen ? 'text-brand-700' : 'text-text-secondary'}>
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A checkbox with a label and a line under it (Figma 407:2760). */
export function CheckboxRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 flex size-4 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-neutral-300 bg-surface-card transition-colors duration-press checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
        <AdminIcon
          name="Check"
          size="xs"
          className="pointer-events-none absolute inset-0 m-auto text-text-inverse opacity-0 transition-opacity duration-press peer-checked:opacity-100"
        />
      </span>
      <span className="flex flex-col text-body-s">
        <span className="font-medium text-neutral-700">{label}</span>
        {description && <span className="text-text-secondary">{description}</span>}
      </span>
    </label>
  );
}
