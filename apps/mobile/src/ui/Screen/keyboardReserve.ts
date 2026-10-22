import type { Edge } from 'react-native-safe-area-context';

export type KeyboardReserveInput = {
  hasFooter: boolean;
  edges: readonly Edge[];
  tabBarInset: boolean;
  insetBottom: number;
};

/**
 * How much of the page's bottom the keyboard may cover without hiding anything: the bottom
 * safe-area strip, wherever the page pads it.
 *
 * The keyboard covers the home indicator, so above it that strip is dead space. A footer (the
 * action bar, the assistant composer) pads it itself, and so does the page root for a screen with
 * a bottom edge; either way, letting the keyboard slide over it puts the bar's buttons a normal
 * `spacing[4]` above the keys — frame by frame, with no state flipping on keyboard events.
 *
 * Zero when nothing pads the inset: under the tab bar (the scroller reserves its space instead)
 * or on a page that asked for no bottom edge.
 *
 * Mirrors `Screen`'s `safeAreaStyle` hand-off, and is pure so it is testable without a renderer.
 */
export function keyboardBottomReserve({
  hasFooter,
  edges,
  tabBarInset,
  insetBottom,
}: KeyboardReserveInput): number {
  if (hasFooter) return insetBottom;
  if (tabBarInset) return 0;
  return edges.includes('bottom') ? insetBottom : 0;
}
