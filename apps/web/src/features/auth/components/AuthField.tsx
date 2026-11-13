import { useId, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { iconSize } from '@/ui/lineIcons';

export type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  /** The line icon at the field's start: a mail for the address, a lock for the password. */
  icon: ComponentType<{ className?: string }>;
  /** A control at the field's end, such as the password's show/hide toggle. */
  trailing?: ReactNode;
  error?: string;
};

/**
 * A sign-in field: label over a pill with a leading icon. The pill takes the focus ring when its
 * input is focused, so the icon and the trailing control sit inside the ring with the text.
 */
export function AuthField({ label, icon: Icon, trailing, error, ...input }: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-s font-semibold text-text-primary max-lg:sr-only">
        {label}
      </label>
      <div
        className={cn(
          'flex h-control-xl items-center gap-3 rounded-full border bg-surface-card pl-4 pr-1.5',
          // On a phone the field is the mockup's taller, softer box, and its placeholder names it.
          'max-lg:h-14 max-lg:gap-4 max-lg:rounded-lg max-lg:pl-5',
          'transition-[border-color,box-shadow] duration-fast ease-standard',
          'focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
          error ? 'border-border-danger' : 'border-border-default hover:border-neutral-400',
        )}
      >
        <Icon
          className={cn(
            iconSize.md,
            'transition-colors duration-fast ease-standard',
            error ? 'text-danger-600' : 'text-text-tertiary',
          )}
        />
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary"
          {...input}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="animate-reveal text-body-s text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
