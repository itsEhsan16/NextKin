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

export type ScreenProps = {
  /** Safe-area edges to pad. Defaults to `['top']`; add `'bottom'` for screens without a tab bar. */
  edges?: readonly Edge[];
  /** Render inside a vertical ScrollView. */
  scroll?: boolean;
  /** Apply the 24pt horizontal gutter. Defaults to true. */
  padded?: boolean;
  /** Reserve space under the content for the floating tab bar + FAB overhang. */
  tabBarInset?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh control (scroll mode only). */
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Handle on the underlying ScrollView (scroll mode only) — e.g. tab re-tap scroll-to-top. */
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
};

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
  contentContainerStyle,
  refreshControl,
  scrollRef,
  children,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarLayout();

  const tabBarSpace = tabBarInset ? tabBar.contentInset : 0;

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

  const contentStyle = useMemo<ViewStyle>(
    () => ({
      paddingHorizontal: padded ? spacing.gutter : 0,
      paddingBottom: tabBarSpace,
    }),
    [padded, spacing.gutter, tabBarSpace],
  );

  if (scroll) {
    return (
      <View style={[styles.root, safeAreaStyle]}>
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

  return (
    <View style={[styles.root, safeAreaStyle, contentStyle, contentContainerStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
