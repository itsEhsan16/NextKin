import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Open or closed: a plain boolean, or one of the sidebar's two states — `'panel'` is open while
 * the sidebar is expanded, `'rail'` while it is collapsed. Those two are decided in CSS (the
 * `rail` variant in `theme.css`), so the sidebar is drawn right before React has read the
 * remembered preference (`toreview.md` §84).
 */
export type CollapseFadeOpen = boolean | 'panel' | 'rail';

export type CollapseFadeProps = {
  /** Whether the content is at its full size and opacity. */
  open: CollapseFadeOpen;
  /** Which dimension collapses to zero. Defaults to the common case: a label beside an icon. */
  axis?: 'horizontal' | 'vertical';
  /**
   * Grow in from closed when it first mounts, rather than appearing at full size: content that
   * arrives late (a count once its query lands) then makes room for itself smoothly.
   */
  animateMount?: boolean;
  className?: string;
  children: ReactNode;
  /**
   * Set on the wrapper when its content is the *inactive* half of a cross-fade (e.g.
   * `UpgradeCard`'s two variants) — takes the whole subtree out of tab order and the
   * accessibility tree while it's visually collapsed, without touching layout the way
   * `display: none` would (`inert` doesn't affect box size, so the CSS transition still plays).
   * jsdom doesn't enforce `inert`'s focus behaviour, so interactive descendants should still set
   * their own `tabIndex={-1}` for a guarantee tests can assert on.
   */
  inert?: boolean;
};

const key = (open: CollapseFadeOpen) => (open === true ? 'open' : open === false ? 'closed' : open);

/**
 * Every class this component can apply, as whole literals: Tailwind finds class names by reading
 * the source, so a name assembled at runtime would never get its CSS
 * (`__tests__/ui/CollapseFade.test.tsx` holds this).
 */
export const COLLAPSE_TRACK = {
  horizontal: {
    open: 'grid-cols-[1fr]',
    closed: 'grid-cols-[0fr]',
    panel: 'grid-cols-[1fr] rail:grid-cols-[0fr]',
    rail: 'grid-cols-[0fr] rail:grid-cols-[1fr]',
  },
  vertical: {
    open: 'grid-rows-[1fr]',
    closed: 'grid-rows-[0fr]',
    panel: 'grid-rows-[1fr] rail:grid-rows-[0fr]',
    rail: 'grid-rows-[0fr] rail:grid-rows-[1fr]',
  },
} as const;

export const COLLAPSE_FADE = {
  open: 'opacity-100',
  closed: 'opacity-0',
  panel: 'opacity-100 rail:opacity-0',
  rail: 'opacity-0 rail:opacity-100',
} as const;

export const COLLAPSE_MOUNT = {
  horizontal: 'starting:grid-cols-[0fr]',
  vertical: 'starting:grid-rows-[0fr]',
  fade: 'starting:opacity-0',
} as const;

/**
 * Wraps content that needs to glide away instead of popping — the sidebar's whole reason for
 * existing. A CSS `width: auto` can't be transitioned directly, so this uses the standard
 * workaround: a single-track grid whose `grid-template-columns` (or `-rows`, for a block that
 * collapses in height) animates between `0fr` and `1fr`. The browser interpolates that track's
 * actual pixel size smoothly, for any content length, with no magic max-width number to guess.
 * An `overflow-hidden` child clips content while the track is mid-shrink, and an inner opacity
 * fade keeps the content from visibly squeezing as it narrows.
 *
 * Keeps using `duration-base`/`ease-standard` — the same tokens the sidebar's own box-width
 * transition already uses — so everything moves on one shared rhythm.
 */
export function CollapseFade({
  open,
  axis = 'horizontal',
  animateMount = false,
  className,
  children,
  inert,
}: CollapseFadeProps) {
  const horizontal = axis === 'horizontal';

  return (
    <div
      inert={inert}
      className={cn(
        'grid',
        horizontal
          ? 'transition-[grid-template-columns] duration-base ease-standard'
          : 'transition-[grid-template-rows] duration-base ease-standard',
        COLLAPSE_TRACK[axis][key(open)],
        animateMount && COLLAPSE_MOUNT[axis],
        className,
      )}
    >
      <div className={cn('overflow-hidden', horizontal ? 'min-w-0' : 'min-h-0')}>
        <div
          className={cn(
            'transition-opacity duration-base ease-standard',
            COLLAPSE_FADE[key(open)],
            animateMount && COLLAPSE_MOUNT.fade,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
