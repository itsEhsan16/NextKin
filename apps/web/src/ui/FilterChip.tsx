import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ChevronDownIcon } from '@/ui/icons';

import { chevronTurn, menuTrigger } from './menuMotion';
import { pressable } from './pressable';

export type FilterChipProps = {
  label: string;
  active: boolean;
  /** A leading glyph: "More filters" (304:2436, 286:1299). */
  icon?: ReactNode;
  /**
   * Where the chevron goes. The Jobs board draws "More filters" with its chevron outside the pill
   * (304:2440). It is still part of the same trigger, so clicking it opens the same menu instead
   * of being a dead glyph. The Applications board draws the same chip with no chevron (286:1299).
   */
  chevron?: 'inside' | 'outside' | 'none';
} & ButtonHTMLAttributes<HTMLButtonElement>;

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

/**
 * A filter or sort trigger; the menu it opens is `FilterDropdown`. One size for every filter row
 * and sort control, on Jobs and Applications alike: `control-sm`, 12px, since the compact pass
 * (`toreview.md` §16).
 */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { label, active, icon, chevron = 'inside', className, ...props },
  ref,
) {
  const face = cn(
    'flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-body-m font-medium',
    active
      ? 'border-border-brand-strong bg-surface-brand text-brand-600'
      : 'border-border-default bg-surface-card text-neutral-700',
  );

  if (chevron === 'outside') {
    return (
      <button
        ref={ref}
        type="button"
        // The whole trigger presses as one; the pill inside only recolours.
        className={cn(
          'group flex items-center gap-1 rounded-full',
          pressable,
          menuTrigger,
          FOCUS,
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            face,
            'transition-colors duration-press ease-standard',
            !active && 'group-hover:bg-surface-muted',
          )}
        >
          {icon}
          {label}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0',
            chevronTurn,
            active ? 'text-brand-600' : 'text-neutral-700',
          )}
        />
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        face,
        pressable,
        !active && 'hover:bg-surface-muted',
        menuTrigger,
        FOCUS,
        className,
      )}
      {...props}
    >
      {icon}
      {label}
      {chevron === 'inside' && <ChevronDownIcon className={cn('size-3.5', chevronTurn)} />}
    </button>
  );
});
