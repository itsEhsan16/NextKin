import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
  ICON_BUTTON_SIZE,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles';
import { Spinner } from './Spinner';
import { StableLabel } from './StableLabel';

export type { ButtonSize, ButtonVariant };

export function buttonClass({
  variant = 'primary',
  size = 'md',
  pill = false,
  iconOnly = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  iconOnly?: boolean;
} = {}): string {
  return cn(
    BUTTON_VARIANT[variant],
    iconOnly ? ICON_BUTTON_SIZE[size] : BUTTON_SIZE[size],
    pill && 'rounded-full',
  );
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
  /** Fully round ends: the reference shots' pill CTAs (toreview §132). */
  pill?: boolean;
  /** A square button holding only `icon`; it must carry an `aria-label`. */
  iconOnly?: boolean;
};

/** The flows' button (toreview §131): variants, sizes, and a loading state that guards itself. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    busyLabel,
    pill = false,
    iconOnly = false,
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
      className={cn(buttonClass({ variant, size, pill, iconOnly }), className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {label}
    </button>
  );
});
