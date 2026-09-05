import { useMemo, type ReactNode, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTabBarLayout, useTheme } from '@/theme';

type ScreenBaseProps = {
  /** Safe-area edges to pad. Defaults to `['top']`; add `'bottom'` for screens without a tab bar. */
  edges?: readonly Edge[];
  /** Apply the 24pt horizontal gutter. Defaults to true. */
  padded?: boolean;
  /**
   * Lifts the page for the keyboard: iOS pads, Android relies on the OS resize.
   *
   * The iOS padding lands on a wrapper *outside* the safe-area box, so the page keeps whatever
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
  scrollRef?: RefObject<ScrollView | null>;
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
};

/**
 * The two page shapes. Every Phase 9B–9I form screen is the same skeleton:
 *
 * ```tsx
 * <Screen keyboard scroll edges={['top','bottom']} header={<ScreenHeader/>} footer={<StickyActionBar/>}>
 * ```
 */
export type ScreenProps = ScrollScreenProps | StaticScreenProps;

const DEFAULT_EDGES: readonly Edge[] = ['top'];

/**
 * Safe-area aware page container. Every route renders exactly one `Screen` at its root so
 * backgrounds, gutters and tab-bar insets stay consistent across the app.
 */
export function Screen({
  edges = DEFAULT_EDGES,
  scroll = false,
  padded = true,
  keyboard = false,
  tabBarInset = false,
  header,
  headerStyle,
  footer,
  footerStyle,
  contentContainerStyle,
  refreshControl,
  scrollRef,
  children,
}: ScreenProps) {
  const { colors, spacing, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarLayout();

  // Only ever non-zero in scroll mode — the types see to that, but state it here too: this
  // lands on the ScrollView's content container, where it lets content pass under the pill.
  const tabBarSpace = scroll && tabBarInset ? tabBar.contentInset : 0;

  // A ReactNode is a new value on every render; only its presence moves the padding below.
  const hasFooter = footer != null;

  const safeAreaStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: colors.surfacePage,
      paddingTop: edges.includes('top') ? insets.top : 0,
      paddingLeft: edges.includes('left') ? insets.left : 0,
      paddingRight: edges.includes('right') ? insets.right : 0,
      // Two things can claim the bottom inset and neither may share it. When the tab bar
      // reserves space it already accounts for the inset; a footer likewise pads
      // `spacing[4] + insets.bottom` itself, so its background runs to the bottom of the glass
      // instead of stopping on a strip of page. The same hand-off in both cases.
      paddingBottom: !tabBarInset && !hasFooter && edges.includes('bottom') ? insets.bottom : 0,
    }),
    [colors.surfacePage, edges, hasFooter, insets, tabBarInset],
  );

  // Everything the pinned header and the scroll content must agree on, so the two columns of
  // rows line up. Note what is absent: `paddingBottom`, which is the tab-bar reservation and
  // belongs only to the thing that scrolls.
  const frameStyle = useMemo<ViewStyle>(
    () => ({
      paddingHorizontal: padded ? spacing.gutter : 0,
      // Past the artboard width the design stops growing and centres, rather than stretching
      // a 520px layout across a tablet.
      width: '100%',
      maxWidth: sizes.designWidth,
      alignSelf: 'center',
    }),
    [padded, sizes.designWidth, spacing.gutter],
  );

  const contentStyle = useMemo<ViewStyle>(
    () => ({ ...frameStyle, paddingBottom: tabBarSpace }),
    [frameStyle, tabBarSpace],
  );

  // Built once so both roots below take the same array. On the static branch the root already
  // spreads `contentStyle`, which is why its header box takes `headerStyle` alone — re-applying
  // the gutter there would double it.
  const rootStyle: StyleProp<ViewStyle> = scroll
    ? [styles.root, safeAreaStyle]
    : [styles.root, safeAreaStyle, contentStyle, contentContainerStyle];

  const page = scroll ? (
    <>
      {/*
        Never `styles.root` here: a `flex: 1` header would take half the viewport and starve
        the scroller. The box is intrinsic height, and RN's default `flexShrink: 0` means the
        scroller cannot squeeze it either.
      */}
      {header != null ? <View style={[frameStyle, headerStyle]}>{header}</View> : null}
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={[contentStyle, contentContainerStyle]}
        contentInsetAdjustmentBehavior="never"
        // Also what dismisses the keyboard on a tap outside a field: the tap reaches the control
        // under it instead of being spent closing the keyboard.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
      {/*
        No `frameStyle` here, unlike the header: the bar spans edge to edge — its hairline and
        upward shadow read as the bottom of the window — and pads its own gutter inside that.
      */}
      {footer != null ? <View style={footerStyle}>{footer}</View> : null}
    </>
  ) : (
    <>
      {header != null ? <View style={headerStyle}>{header}</View> : null}
      {children}
    </>
  );

  if (!keyboard) return <View style={rootStyle}>{page}</View>;

  return (
    <KeyboardAvoidingView
      // Only the flex lives out here, never `rootStyle`. `behavior="padding"` *composes* the
      // keyboard's height over the style it is handed, and that height is 0 while the keyboard
      // is down — handing it the safe-area box would zero the bottom inset out from under every
      // keyboard screen that has no footer to own it.
      style={styles.root}
      // iOS gets no help from the OS, so the wrapper is padded by the keyboard's height and the
      // `flex: 1` box inside it shrinks to match, carrying the footer up. Android already resizes
      // the window through `windowSoftInputMode`, and padding on top of that would shift the page
      // twice — hence `undefined` there, and a zero offset on both.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={rootStyle}>{page}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
