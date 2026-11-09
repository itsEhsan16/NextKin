import type { ReactNode, RefObject } from 'react';
import type { ScrollViewInstance, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

/** `Screen`'s props, split out of Screen.tsx to keep it under the size guideline. */

export type ScreenBaseProps = {
  /** Safe-area edges to pad. Defaults to `['top']`; add `'bottom'` for screens without a tab bar. */
  edges?: readonly Edge[];
  /** Apply the 24pt horizontal gutter. Defaults to true. */
  padded?: boolean;
  /**
   * The redesign's lavender wash behind the top of the page, header and status bar included
   * (§176). It stays put while the content scrolls over it.
   */
  wash?: boolean;
  /**
   * Scroll mode only: the page runs up behind the status bar instead of starting under it, so a
   * wash drawn in the content reaches the top of the glass (§199). The content keeps the inset
   * as its first padding, and a strip fades in behind the status bar once the page scrolls.
   */
  bleedTop?: boolean;
  /**
   * Lifts the page for the keyboard, frame by frame on both platforms (see `KeyboardFrame`).
   *
   * The padding lands on a wrapper *outside* the safe-area box, so the page keeps whatever
   * `edges` asked for; a `footer` inside that box rides up with the keyboard rather than being
   * covered by it. Tapping outside a field still reaches the control under it — see
   * `keyboardShouldPersistTaps` on the scroller.
   */
  keyboard?: boolean;
  /**
   * A region pinned to the top of the page: a sibling rendered *above* whatever scrolls, so it
   * never moves.
   *
   * Deliberately not `stickyHeaderIndices`. A sticky child is still inside the scroller, so it
   * travels until it docks and re-lays out on every frame of that travel; this one is simply not
   * in the scroll box, so the scroll viewport *starts* at its bottom edge. Nothing measures and
   * nothing overlaps — flexbox does the occlusion.
   *
   * In scroll mode the box gets the gutter, maxWidth and centring the scroll content gets, so
   * the pinned rows line up with the rows below them. It never gets the tab-bar inset: that is a
   * reservation at the far end of the scroll run, not a page-top offset.
   */
  header?: ReactNode;
  /**
   * Style for the box `header` renders in.
   *
   * The page's *top* padding belongs here rather than on `contentContainerStyle`, which now
   * starts below the header. Screens differ enough in what else the box needs — a gap between
   * two pinned rows, a gutter that `padded={false}` opted out of — that it is stated per screen
   * instead of assumed here.
   */
  headerStyle?: StyleProp<ViewStyle>;
  /**
   * The soft edge under a pinned `header` (EdgeFade). A scrolling page always has it, shown once
   * something has scrolled under the header. A static page hosting its own list (FlashList) opts
   * in: its list's top padding must be deeper than the fade, so at rest it falls on bare page.
   */
  headerFade?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

type ScrollScreenProps = ScreenBaseProps & {
  /** Render inside a vertical ScrollView. */
  scroll: true;
  /** Reserve space under the content for the floating tab bar + FAB overhang. */
  tabBarInset?: boolean;
  /**
   * The mirror of `header`: a bar pinned *below* the scroller, inside the keyboard-avoiding view,
   * so it rides up with the keyboard instead of being covered by it.
   *
   * Scroll-only, for the same reason `tabBarInset` is. The static branch's root *is* the
   * gutter-padded content box, so a full-bleed hairline bar rendered inside it would stop 24pt
   * short of both edges and its shadow would float in the middle of the page. A static screen
   * composes the bar itself, the way `ResumeScoreScreen` does.
   *
   * It also owns the bottom safe area — see `safeAreaStyle` — because the bar's background has
   * to reach the bottom of the glass rather than sit above a strip of bare page.
   */
  footer?: ReactNode;
  /** Style for the box `footer` renders in. The bar's own padding and hairline live inside it. */
  footerStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh control. */
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Handle on the underlying ScrollView — e.g. tab re-tap scroll-to-top. */
  scrollRef?: RefObject<ScrollViewInstance | null>;
  /**
   * Keep the end of the content in view while it grows — a streaming reply — as long as the
   * reader is already at the end. Scrolled up to read, the page stays where they put it.
   */
  followEnd?: boolean;
};

/**
 * A screen that is not itself a scroller.
 *
 * `tabBarInset` is deliberately unavailable here. The inset has to land on the *content* of
 * whatever scrolls, and this variant has no content container to put it on — applying it to the
 * page box instead just shortens the viewport, leaving the page background painted under the
 * floating pill and the last row cut off at the edge of a list that can no longer reach it. A
 * screen hosting its own list owns the inset: read `useTabBarLayout().contentInset` and pass it
 * to that list's `contentContainerStyle`.
 *
 * `footer` is unavailable for the neighbouring reason: this root carries the gutter itself, so a
 * bar placed inside it could not span the window.
 */
type StaticScreenProps = ScreenBaseProps & {
  scroll?: false;
  tabBarInset?: never;
  footer?: never;
  footerStyle?: never;
  refreshControl?: never;
  scrollRef?: never;
  followEnd?: never;
};

/**
 * The two page shapes. Every Phase 9B–9I form screen is the same skeleton:
 *
 * ```tsx
 * <Screen keyboard scroll edges={['top','bottom']} header={<ScreenHeader/>} footer={<StickyActionBar/>}>
 * ```
 */
export type ScreenProps = ScrollScreenProps | StaticScreenProps;
