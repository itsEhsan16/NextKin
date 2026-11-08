import type { ComponentType, KeyboardEvent, ReactNode, SVGProps } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { CloseIcon } from '@/ui/icons';
import { iconButton } from '@/ui/iconButton';

export type OnboardingFieldProps = {
  label: string;
  /** Printed above the box (814:126); without it the label is for screen readers only (814:8). */
  showLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  /** The name field's larger type (814:11). */
  emphasis?: boolean;
  /** The × that empties the box (814:130). ONB 05's fields draw none (816:10). */
  clearable?: boolean;
  /** Keys pressed in the box: ONB 06's "Type a skill and press Enter". */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Shown in place of the box while its starting value loads. */
  loading?: ReactNode;
};

/**
 * The boards' input (814:9, 814:127): a glyph, the text, and an × that clears it once there is
 * something to clear. It turns lavender with an indigo edge while focused, as ONB 01 draws it.
 */
export function OnboardingField({
  label,
  showLabel = false,
  value,
  onChange,
  Icon,
  placeholder,
  autoComplete,
  autoFocus,
  emphasis = false,
  clearable = true,
  onKeyDown,
  loading,
}: OnboardingFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={showLabel ? 'text-body-m font-semibold text-neutral-700' : 'sr-only'}
      >
        {label}
      </label>
      {loading ?? (
        <div
          className={cn(
            'flex h-control-lg items-center gap-2.5 rounded-md border border-border-default bg-surface-card pl-3.5 pr-1.5',
            'transition-colors duration-press ease-standard hover:border-neutral-400',
            'focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100 focus-within:hover:border-border-selected',
            emphasis && 'h-control-xl',
          )}
        >
          <Icon className="size-3.5 shrink-0 text-text-tertiary" />
          <input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            className={cn(
              'min-w-0 flex-1 bg-transparent font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-neutral-400',
              emphasis ? 'text-h2' : 'text-body-l',
            )}
          />
          {clearable && value && (
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={() => onChange('')}
              className={cn(iconButton, 'text-neutral-400 hover:text-text-secondary')}
            >
              <CloseIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
