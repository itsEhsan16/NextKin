import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { brandButton } from './brandButton';
import { dangerOutlineButton } from './dangerOutlineButton';
import { outlineButton } from './outlineButton';
import { pressable } from './pressable';
import { Spinner } from './Spinner';
import { StableLabel } from './StableLabel';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: brandButton,
  secondary: outlineButton,
  ghost: `inline-flex items-center justify-center text-text-secondary ${pressable} not-disabled:not-aria-disabled:hover:bg-surface-muted not-disabled:not-aria-disabled:hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60`,
  danger: dangerOutlineButton,
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-control-sm gap-1.5 rounded-md px-3 text-body-m font-medium',
  md: 'h-control-md gap-2 rounded-md px-3.5 text-body-m font-semibold',
  lg: 'h-control-lg gap-2 rounded-md px-5 text-body-l font-semibold',
};

/**
 * One button look for the flows (toreview §131), as classes for a `Link` that has to look like a
 * button. `primary` is the flat brand action; the bevelled `primaryButton` stays on the two
 * boards that draw a bevel (the AI card, Upgrade).
 */
export function buttonClass({
  variant = 'primary',
  size = 'md',
}: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return cn(VARIANT[variant], SIZE[size]);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A leading icon; swapped for the spinner while `loading`. */
  icon?: ReactNode;
  /**
   * The action is running: the button is disabled (no second submit), says so to assistive tech
   * with `aria-busy`, and shows the spinner and `busyLabel` without changing width.
   */
  loading?: boolean;
  /** What a text label says while `loading`: "Saving…". */
  busyLabel?: string;
};

/** The flows' button (toreview §131): variants, sizes, and a loading state that guards itself. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    busyLabel,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const label =
    typeof children === 'string' && busyLabel ? (
      <StableLabel label={children} busyLabel={busyLabel} busy={loading} />
    ) : (
      children
    );
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass({ variant, size }), className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {label}
    </button>
  );
});
