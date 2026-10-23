import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The surface every card outside Home sits on (`toreview.md` §102): `radius/lg`, the card border and
 * the card fill. Detail panels, Profile, Settings, Upload, Help, the viewer, Insights and the
 * Assistant's asides all draw it; add `shadow-card` where a board lifts its cards off the page.
 */
export const cardSurface = 'rounded-lg border border-border-subtle bg-surface-card shadow-card';

/** The one padding a card's content takes (toreview §132): every card breathes the same. */
export const cardPad = 'p-6';

/**
 * A card that is itself a link or button: it lifts toward the pointer and settles when pressed
 * (toreview §132). One whole string, so Tailwind reads it.
 */
export const cardInteractive =
  'transition-[box-shadow,translate,scale,background-color,border-color] duration-base ease-standard hover:-translate-y-0.5 hover:shadow-card-hover active:scale-(--scale-pressed)';

export type CardProps = {
  children: ReactNode;
  className?: string;
  /** The lavender wash the AI promo card uses (surface/brand). */
  tone?: 'card' | 'brand';
};

/**
 * The Home board's surface (286:324, 286:598, 286:640, 286:729).
 *
 * `radius/lg` 16 with a `border/subtle` hairline and a soft elevation — read off 286:729 and
 * 286:640, which are the two cards that state their own values. The brand tone swaps the border
 * to `border/brand` and takes the wider shadow the AI card carries.
 */
export function Card({ children, className, tone = 'card' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border',
        tone === 'brand'
          ? 'border-border-brand bg-surface-brand'
          : 'border-border-subtle bg-surface-card shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
