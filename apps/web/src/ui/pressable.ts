/**
 * What every button does under the pointer (`toreview.md` §84): its colours and opacity ease
 * on `press` (120ms), and while it's held down it settles to `--scale-pressed` (98%) and springs
 * back on release. A disabled button — natively, or `aria-disabled` while it works — neither
 * presses nor reacts to hover.
 *
 * One whole string: Tailwind reads class names from the source text, so it can't be assembled
 * at runtime (`__tests__/ui/pressable.test.ts`). Pair hover colours with `hoverable`, below.
 */
export const pressable =
  'transition-[color,background-color,border-color,opacity,scale] duration-press ease-standard not-disabled:not-aria-disabled:active:scale-(--scale-pressed)';

/**
 * `pressable` for a tile that also lifts its shadow under the pointer: the Assistant's topic tiles
 * (`toreview.md` §102). A separate whole string, because adding `transition-[box-shadow]` after
 * `pressable` makes tailwind-merge drop `pressable`'s own transition, scale included, and the
 * press then snaps instead of settling.
 */
export const pressableLift =
  'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-press ease-standard not-disabled:not-aria-disabled:active:scale-(--scale-pressed)';

/**
 * A clickable card's face, which follows the invisible cover button laid over it (the cover is
 * the `peer`, the card's wrapper the `group/card`): a faint tint under the pointer, and the press
 * settle while the cover is held — not while the card's own bookmark is.
 */
export const cardFaceMotion =
  'transition-[color,background-color,border-color,outline-color,scale,box-shadow,translate] duration-base ease-standard peer-active:scale-(--scale-pressed)';

/** The tint an unselected card takes under the pointer (your call, §84). */
export const cardFaceHover = 'group-hover/card:-translate-y-0.5 group-hover/card:shadow-card-hover';
