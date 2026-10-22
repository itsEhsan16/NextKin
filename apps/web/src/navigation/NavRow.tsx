import Link from 'next/link';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { RailTooltip } from '@/ui/RailTooltip';

import { NavGlyph } from './NavGlyph';
import type { NavItem } from './navItems';
import { navRowTransition } from './navRowMotion';

export type NavRowProps = {
  item: NavItem;
  /**
   * Whether the sidebar is the rail, as React knows it. How the row *looks* in either state is
   * CSS (`rail:` classes), so the first paint is right before React has read the preference;
   * this drives only what CSS can't: the tooltip that names the icon (`toreview.md` §84).
   */
  collapsed: boolean;
  active: boolean;
  count?: number | undefined;
  /** Called when a click starts a client-side navigation, before the new route has loaded. */
  onNavigate?: () => void;
};

/**
 * One persistent element for both the rail and the panel row — previously two structurally
 * different `<Link>`s swapped by `collapsed`, which meant the row itself jumped between layouts
 * with no transition at all. `width`/`height`/`padding`/`gap` are literal values in both states,
 * never `auto` or a percentage, so they can transition directly. The height is `--nav-row`, which
 * `Sidebar.tsx` sets: 40px, or 36 in the expanded panel on a short window. Collapsed, 4px of
 * padding either side of the 32px icon column fills the 40px square exactly (4 + 32 + 4 = 40),
 * which is what keeps the icon on the rail's centre line. Expanded, the row is the panel's own
 * content width, 200 (`Sidebar.tsx` shows the arithmetic) — not `w-full`/100%, which inside a
 * `<li>` the caller sizes with `w-fit` is a circular reference CSS falls back to resolving as
 * `auto`, which is what made the row jump instead of ease when this was first built. The caller
 * renders the `<li>`.
 *
 * The current row's look — a filled pill in the panel, a ring on the rail — isn't drawn here:
 * `SlidingHighlight` draws it once per list and glides it from row to row (`toreview.md` §29).
 * The row recolours its icon and label on the same 220ms as that glide, and keeps a hover fill
 * for the rows that aren't current, so hover never paints over the pill.
 */
export function NavRow({ item, collapsed, active, count, onNavigate }: NavRowProps) {
  const { Icon, label, href } = item;
  const hasCount = count != null && count > 0;

  return (
    <RailTooltip label={label} enabled={collapsed}>
      <Link
        href={href}
        onNavigate={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-(--nav-row) w-[200px] items-center gap-3 overflow-hidden rounded-md pl-3 pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 rail:w-10 rail:gap-0 rail:pl-1 rail:pr-1',
          navRowTransition,
          !active && 'hover:bg-surface-muted',
        )}
      >
        {/* The glyph carries its own palette (711:2 draws it unchanged on the active row), so
          only the label below recolours with the highlight. */}
        <NavGlyph Icon={Icon} />

        {/*
        Not `CollapseFade`: this label already sits in a flex row whose own width is
        transitioning (above), and it's the `flex-1` child that absorbs the difference — the
        row shrinking from 200px to 40px already drives this wrapper's width to zero (the
        padding and icon leave nothing else to grow into) with no separate mechanism needed.
        Stacking `CollapseFade`'s own grid-collapse on top of that outer flex-driven resize would
        compound two independently-eased animations into one non-linear motion. Just the opacity
        fade, riding the same resize the row itself is already doing. Colour and weight ride the
        highlight's 220ms as well: Plus Jakarta Sans loads as a variable font (no `weight` in
        `app/layout.tsx`), so 400 → 600 fades rather than snapping. Clipped by the wrapper, not
        truncated: an ellipsis would flash ("Applica…") as the row narrows mid-collapse.
      */}
        <span className="min-w-0 flex-1 overflow-hidden">
          <span
            className={cn(
              'block whitespace-nowrap text-body-l opacity-100 transition-[opacity,color,font-weight] duration-base ease-standard rail:opacity-0',
              active ? 'font-semibold text-text-brand' : 'text-text-secondary',
            )}
          >
            {label}
          </span>
        </span>

        {/* The badge is a fixed-size pill (shrink-0, not flex-grow), so unlike the label it has
          no outer resize to ride — CollapseFade is the right, sole mechanism here. The row's gap
          plus the label's `flex-1` already push it flush right, matching the pill's original
          `ml-auto` positioning, so no extra margin is needed. It arrives after its query does, so
          it grows in rather than narrowing the label in one frame. */}
        {hasCount && (
          <CollapseFade open="panel" animateMount className="shrink-0">
            <span className="flex min-w-5 items-center justify-center rounded-full bg-surface-muted px-1.5 py-0.5 text-caption-m font-semibold text-text-primary">
              {count}
            </span>
          </CollapseFade>
        )}

        {/* The rail's compact indicator, cross-fading against the panel's numeric pill above. */}
        {hasCount && (
          <span
            aria-hidden
            className="absolute right-1 top-1 size-1.5 rounded-full bg-brand-600 opacity-0 transition-opacity duration-base ease-standard rail:opacity-100 rail:starting:opacity-0"
          />
        )}
      </Link>
    </RailTooltip>
  );
}
