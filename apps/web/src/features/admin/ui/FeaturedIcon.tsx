import { forwardRef } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon, type AdminIconHandle } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';

export type FeaturedTone = 'brand' | 'danger' | 'warning' | 'success' | 'info' | 'neutral';

/** Two rings in the tone at 8% and 16%, the glyph in the tone's ink (Figma 395:753, 407:2700). */
const TONE: Record<FeaturedTone, { outer: string; inner: string }> = {
  brand: { outer: 'bg-brand-600/8 text-brand-600', inner: 'bg-brand-600/16' },
  danger: { outer: 'bg-danger-600/8 text-danger-600', inner: 'bg-danger-600/16' },
  warning: { outer: 'bg-warning-600/8 text-warning-600', inner: 'bg-warning-600/16' },
  success: { outer: 'bg-success-600/8 text-success-600', inner: 'bg-success-600/16' },
  info: { outer: 'bg-info-600/8 text-info-600', inner: 'bg-info-600/16' },
  neutral: { outer: 'bg-neutral-600/8 text-neutral-600', inner: 'bg-neutral-600/16' },
};

/** 48/36 in a dialog's head, 40/30 in a queue row, 32/24 on a timeline. */
const SIZE = {
  lg: { outer: 'size-12', inner: 'size-9', icon: 'lg' },
  md: { outer: 'size-10', inner: 'size-[30px]', icon: 'sm' },
  sm: { outer: 'size-8', inner: 'size-6', icon: 'xs' },
} as const;

export type FeaturedIconProps = {
  name: AdminIconName;
  tone: FeaturedTone;
  size?: keyof typeof SIZE;
  className?: string;
};

/** The boards' "featured icon": a glyph in two soft rings of its tone. Decorative. */
export const FeaturedIcon = forwardRef<AdminIconHandle, FeaturedIconProps>(function FeaturedIcon(
  { name, tone, size = 'md', className },
  ref,
) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        SIZE[size].outer,
        TONE[tone].outer,
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full',
          SIZE[size].inner,
          TONE[tone].inner,
        )}
      >
        <AdminIcon ref={ref} name={name} size={SIZE[size].icon} />
      </span>
    </span>
  );
});
