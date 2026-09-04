import { useMemo, type ReactNode, type RefObject } from 'react';
import {
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
 */
type StaticScreenProps = ScreenBaseProps & {
  scroll?: false;
  tabBarInset?: never;
  refreshControl?: never;
  scrollRef?: never;
};

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
  tabBarInset = false,
  header,
  headerStyle,
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

  const safeAreaStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: colors.surfacePage,
      paddingTop: edges.includes('top') ? insets.top : 0,
      paddingLeft: edges.includes('left') ? insets.left : 0,
      paddingRight: edges.includes('right') ? insets.right : 0,
      // When the tab bar reserves space it already accounts for the bottom inset.
      paddingBottom: !tabBarInset && edges.includes('bottom') ? insets.bottom : 0,
    }),
    [colors.surfacePage, edges, insets, tabBarInset],
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

  if (scroll) {
    return (
      <View style={[styles.root, safeAreaStyle]}>
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  // The root already spreads `contentStyle`, so the header box takes `headerStyle` alone —
  // re-applying the gutter here would double it.
  return (
    <View style={[styles.root, safeAreaStyle, contentStyle, contentContainerStyle]}>
      {header != null ? <View style={headerStyle}>{header}</View> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
