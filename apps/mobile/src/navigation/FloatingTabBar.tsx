import { useRouter, useSegments } from 'expo-router';
import { memo, useCallback, useEffect, useRef, type FC } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import HomeIcon from '../../assets/icons/nav/home.svg';
import JobsIcon from '../../assets/icons/nav/jobs.svg';
import ProfileIcon from '../../assets/icons/nav/profile.svg';
import ResumesIcon from '../../assets/icons/nav/resumes.svg';
import { haptics } from '@/lib';
import { scaledSheet, useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { sheetBackgroundA11yProps } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { useCreateSheet } from './createSheet';
import { scrollTabToTop, type TabName } from './tabScroll';

/** The typed hrefs for the four tab routes. */
type TabHref = '/(tabs)' | '/(tabs)/jobs' | '/(tabs)/resumes' | '/(tabs)/profile';

/** `w`/`h` are the Figma icon boxes — each glyph has its own aspect ratio, so they are not square. */
type TabMeta = { name: TabName; label: string; href: TabHref; Icon: FC<SvgProps>; w: number; h: number };

/** Presentation + destination per tab, in the order they sit in the pill. */
const TABS: readonly TabMeta[] = [
  // Figma nodes 77:4 / 77:8 / 77:16 / 77:22 (matches each SVG's intrinsic size).
  { name: 'index', label: 'Home', href: '/(tabs)', Icon: HomeIcon, w: 20.4975, h: 23.885 },
  { name: 'jobs', label: 'Jobs', href: '/(tabs)/jobs', Icon: JobsIcon, w: 22.6085, h: 21.7917 },
  {
    name: 'resumes',
    label: 'Resumes',
    href: '/(tabs)/resumes',
    Icon: ResumesIcon,
    w: 21.1013,
    h: 18.7122,
  },
  {
    name: 'profile',
    label: 'Profile',
    href: '/(tabs)/profile',
    Icon: ProfileIcon,
    w: 21.1013,
    h: 21.1013,
  },
];

/**
 * Router segment → tab. `index` is deliberately absent: inside the group its segments are just
 * `['(tabs)']`, so "no tab segment matched" *is* the Home tab.
 */
const TAB_BY_SEGMENT: Record<string, TabName> = {
  jobs: 'jobs',
  resumes: 'resumes',
  profile: 'profile',
};

/** Index after which the FAB slot is inserted (2 tabs | FAB | 2 tabs). */
const FAB_SLOT_AFTER = 1;

/**
 * Floor for icon shrinkage, as a fraction of the designed size — glyphs stay legible on narrow
 * screens. Applied to width and height alike so the aspect ratio survives the clamp.
 */

function activeTabFor(segments: readonly string[]): TabName {
  for (const segment of segments) {
    const tab = TAB_BY_SEGMENT[segment];
    if (tab) return tab;
  }
  return 'index';
}

type TabItemProps = {
  name: TabName;
  label: string;
  Icon: FC<SvgProps>;
  focused: boolean;
  iconWidth: number;
  iconHeight: number;
  onPress: (name: TabName) => void;
};

/**
 * Memoised: each tab renders TWO SVG trees for the colour cross-fade, so an unmemoised item
 * would put eight SVG re-renders in the same frame as every navigation transition. All props
 * are primitives or module-level constants, and the handler is stable, so only the two tabs
 * whose `focused` actually flipped re-render.
 */
const TabItem = memo(function TabItem({
  name,
  label,
  Icon,
  focused,
  iconWidth,
  iconHeight,
  onPress,
}: TabItemProps) {
  const { colors, motion } = useTheme();
  const styles = useStyles();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, motion.timings.tabSwitch));
  }, [active, focused, motion.timings.tabSwitch]);

  // Two tinted copies cross-fade on the UI thread — SVG fills can't interpolate colour directly.
  const activeStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));

  const handlePress = useCallback(() => onPress(name), [onPress, name]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      feedback="subtle"
      haptic="none"
      onPress={handlePress}
      style={styles.tab}
    >
      <View style={{ width: iconWidth, height: iconHeight }}>
        <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
          <Icon width={iconWidth} height={iconHeight} color={colors.tabInactive} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          <Icon width={iconWidth} height={iconHeight} color={colors.tabActive} />
        </Animated.View>
      </View>
      <Text variant="tabLabel" color="tabLabel" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * Floating pill tab bar from the Home artboard.
 *
 * Rendered as a sibling of the tab navigator — *after* the create sheet — rather than through the
 * navigator's `tabBar` prop, because Figma CREATE 01/02 paint the pill on top of both the scrim
 * and the sheet (nodes 77:226 / 77:290 are the last children of the frame). That puts it outside
 * the navigator, so it drives itself: active tab from `useSegments()`, navigation through the
 * typed hrefs. The FAB is a later sibling still, so the centre slot here stays empty.
 *
 * The bar positions itself absolutely and reserves no layout space — `Screen`'s `tabBarInset`
 * remains the single source of bottom padding for scrolling content.
 */
export function FloatingTabBar() {
  const { colors, shadows, s } = useTheme();
  const styles = useStyles();
  const layout = useTabBarLayout();
  const router = useRouter();
  const segments = useSegments();
  const { isOpen } = useCreateSheet();

  const active = activeTabFor(segments);

  // Both the active tab and the router identity change across navigations. Read them through a
  // ref so the press handler keeps a stable identity and the memoised tabs stay put.
  const live = useRef({ active, router });
  useEffect(() => {
    live.current = { active, router };
  });

  const handlePress = useCallback((name: TabName) => {
    const { active: current, router: nav } = live.current;
    // Re-tapping the focused tab scrolls it to the top instead of re-navigating to itself.
    if (name === current) {
      if (scrollTabToTop(name)) haptics.selection();
      return;
    }
    const target = TABS.find((tab) => tab.name === name);
    if (!target) return;

    haptics.selection();
    nav.navigate(target.href);
  }, []);

  return (
    <View
      // Paints above the create sheet, but must not be tappable through it: the scrim owns taps
      // while the sheet is open, so a tab press can never navigate behind an open modal.
      pointerEvents={isOpen ? 'none' : 'box-none'}
      style={[styles.host, { bottom: layout.bottomOffset }]}
      // Paints above the create sheet (Figma), but sits behind it semantically: while the sheet
      // is open the pill leaves the accessibility tree. The FAB is a separate sibling and stays
      // reachable so its rotated "✕" can dismiss the sheet.
      {...sheetBackgroundA11yProps(isOpen)}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          shadows.tabBar,
          {
            width: layout.pillWidth,
            height: layout.pillHeight,
            borderRadius: layout.pillRadius,
            backgroundColor: colors.tabBarBackground,
          },
        ]}
      >
        {TABS.flatMap((tab, index) => {
          const item = (
            <TabItem
              key={tab.name}
              name={tab.name}
              label={tab.label}
              Icon={tab.Icon}
              focused={tab.name === active}
              iconWidth={s(tab.w)}
              iconHeight={s(tab.h)}
              onPress={handlePress}
            />
          );
          // Centre slot is reserved for the FAB, which renders above the sheet scrim.
          return index === FAB_SLOT_AFTER
            ? [item, <View key="fab-slot" style={styles.fabSlot} />]
            : [item];
        })}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(6) },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', gap: s(3) },
  fabSlot: { flex: 1 },
}));
