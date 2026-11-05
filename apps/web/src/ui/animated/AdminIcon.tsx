'use client';

import { useReducedMotion } from 'motion/react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import UseAnimations, { type EventProps } from 'react-useanimations';

import { cn } from '@/lib/cn';
import { iconSizes, type IconSize } from '@/theme/tokens';

import { ADMIN_ICONS, type AdminIconName, type LucideHandle } from './iconMap';

/** Plays an icon's animation from outside it: the row, button or card it sits in. */
export type AdminIconHandle = { start: () => void; stop: () => void };

export type AdminIconProps = {
  /** The board's name for the icon (Figma 382:937), e.g. `Users01`. */
  name: AdminIconName;
  size?: IconSize;
  className?: string;
};

/**
 * A board icon, animated (`iconMap.ts` says where each comes from).
 *
 * Without a ref the icon plays when the pointer is over the glyph itself. With one, the icon only
 * plays when the ref is told to, so a whole nav row or button can start it on hover rather than
 * the 20px glyph: see `useIconHover`. Reduced motion keeps every icon still. Always decorative:
 * the element it sits in carries the name.
 */
export const AdminIcon = forwardRef<AdminIconHandle, AdminIconProps>(function AdminIcon(
  { name, size = 'lg', className },
  ref,
) {
  const source = ADMIN_ICONS[name];
  const px = iconSizes[size];
  const reduced = useReducedMotion() ?? false;
  const controlled = ref != null;

  const lucide = useRef<LucideHandle>(null);
  const ua = useRef<EventProps | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      start: () => {
        if (reduced) return;
        if (lucide.current) lucide.current.startAnimation();
        // react-useanimations reads nothing from the event but whether it was cancelled.
        ua.current?.onMouseEnter({ defaultPrevented: false } as MouseEvent<HTMLElement>);
      },
      stop: () => {
        if (lucide.current) lucide.current.stopAnimation();
        ua.current?.onMouseLeave({ defaultPrevented: false } as MouseEvent<HTMLElement>);
      },
    }),
    [reduced],
  );

  const box = cn('inline-flex shrink-0 items-center justify-center', className);

  if (source.kind === 'lucide') {
    const { Icon } = source;
    return (
      <Icon
        aria-hidden
        size={px}
        className={box}
        // Under reduced motion a ref makes the icon ignore its own hover, and `start` does nothing.
        ref={controlled || reduced ? lucide : undefined}
      />
    );
  }

  return (
    <UseAnimations
      animation={source.animation}
      interaction="hover"
      size={px}
      render={(eventProps, animationProps) => {
        ua.current = eventProps;
        return (
          <span
            {...animationProps}
            {...(controlled ? {} : eventProps)}
            aria-hidden
            className={box}
          />
        );
      }}
    />
  );
});

/**
 * Wires an icon's animation to the element around it: spread `hoverProps` on the row or button and
 * pass `iconRef` to its `AdminIcon`. Keyboard focus plays it too, the way hover does.
 */
export function useIconHover() {
  const iconRef = useRef<AdminIconHandle>(null);
  const start = useCallback(() => iconRef.current?.start(), []);
  const stop = useCallback(() => iconRef.current?.stop(), []);

  const hoverProps = useMemo(
    () => ({
      onMouseEnter: start,
      onMouseLeave: stop,
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget.matches(':focus-visible')) start();
      },
      onBlur: stop,
    }),
    [start, stop],
  );

  return { iconRef, hoverProps };
}
