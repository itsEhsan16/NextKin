import { useRouter, useSegments } from 'expo-router';
import { memo, useCallback, useEffect, useRef, type FC } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import HomeFilled from '../../assets/icons/nav/home-filled.svg';
import HomeOutline from '../../assets/icons/nav/home-outline.svg';
import JobsFilled from '../../assets/icons/nav/jobs-filled.svg';
import JobsOutline from '../../assets/icons/nav/jobs-outline.svg';
import ProfileFilled from '../../assets/icons/nav/profile-filled.svg';
import ProfileOutline from '../../assets/icons/nav/profile-outline.svg';
import ResumesFilled from '../../assets/icons/nav/resumes-filled.svg';
import ResumesOutline from '../../assets/icons/nav/resumes-outline.svg';
import { haptics } from '@/lib';
import { NAV_BOOST, scaledSheet, useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { sheetBackgroundA11yProps } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { useCreateSheet } from './createSheet';
import { scrollTabToTop, type TabName } from './tabScroll';

/** The typed hrefs for the four tab routes. */
type TabHref = '/(tabs)' | '/(tabs)/jobs' | '/(tabs)/resumes' | '/(tabs)/profile';

/**
 * Every number here is read off Home Screen 215:490 and divided by 0.75, because that board is
 * 390 wide and `sizes`/`s()` are 520 space.
 *
 * `Icon`/`IconActive` are the outline and filled cuts of the same glyph. The four state boards
 * (220:522 / 553 / 584 / 615) differ in exactly one thing: the selected tab's icon is the filled
 * variant and the other three are outlines. Nothing else moves — every label stays black in all
 * four, which is why there is no inactive tint any more.
 *
 * `w`/`h` are the icon boxes — each glyph has its own aspect ratio, so they are not square. Both
 * cuts of a glyph share an aspect ratio, so one box serves both and the icon cannot jump as it
 * crosses over.
 * `centre` is where the board puts the tab, as a fraction of the pill width: the four are NOT
 * evenly spaced, and equal flex puts Resumes ~6pt left of where it is drawn. `slot` is the
 * tab’s own width, also a fraction of the pill — sized to its label plus a little padding, so
 * no two touch targets overlap and none of them clips its own text.
 */
type TabMeta = {
  name: TabName;
  label: string;
  href: TabHref;
  Icon: FC<SvgProps>;
  IconActive: FC<SvgProps>;
  w: number;
  h: number;
  centre: number;
  slot: number;
};

/** Presentation + destination per tab, in the order they sit in the pill. */
const TABS: readonly TabMeta[] = [
  // Icons 215:492 / 215:496 / 215:504 / 215:510; centres and slots against the 299.9475 pill.
  {
    name: 'index',
    label: 'Home',
    href: '/(tabs)',
    Icon: HomeOutline,
    IconActive: HomeFilled,
    w: 21.9966,
    h: 25.6318,
    centre: 0.1126,
    slot: 0.132,
  },
  {
    name: 'jobs',
    label: 'Jobs',
    href: '/(tabs)/jobs',
    Icon: JobsOutline,
    IconActive: JobsFilled,
    w: 24.2619,
    h: 23.3852,
    centre: 0.2952,
    slot: 0.107,
  },
  {
    name: 'resumes',
    label: 'Resumes',
    href: '/(tabs)/resumes',
    Icon: ResumesOutline,
    IconActive: ResumesFilled,
    w: 22.6444,
    h: 20.0806,
    centre: 0.6972,
    slot: 0.19,
  },
  {
    name: 'profile',
    label: 'Profile',
    href: '/(tabs)/profile',
    Icon: ProfileOutline,
    IconActive: ProfileFilled,
    w: 22.6444,
    h: 22.6444,
    centre: 0.8808,
    slot: 0.14,
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
  IconActive: FC<SvgProps>;
  focused: boolean;
  iconWidth: number;
  iconHeight: number;
  /** Absolute slot inside the pill, centred on the tab’s board position. */
  slot: ViewStyle;
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
  IconActive,
  focused,
  iconWidth,
  iconHeight,
  slot,
  onPress,
}: TabItemProps) {
  const { colors, motion } = useTheme();
  const styles = useStyles();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, motion.timings.tabSwitch));
  }, [active, focused, motion.timings.tabSwitch]);

  // The two cuts cross-fade on the UI thread. SVG paths cannot be interpolated, and a hard swap
  // reads as a flicker at this size.
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
      style={[styles.tab, slot]}
    >
      <View style={{ width: iconWidth, height: iconHeight }}>
        <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
          <Icon width={iconWidth} height={iconHeight} color={colors.tabActive} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          <IconActive width={iconWidth} height={iconHeight} color={colors.tabActive} />
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
        {TABS.map((tab) => (
          <TabItem
            key={tab.name}
            name={tab.name}
            label={tab.label}
            Icon={tab.Icon}
            IconActive={tab.IconActive}
            focused={tab.name === active}
            iconWidth={s(tab.w * NAV_BOOST)}
            iconHeight={s(tab.h * NAV_BOOST)}
            slot={{
              left: (tab.centre - tab.slot / 2) * layout.pillWidth,
              width: tab.slot * layout.pillWidth,
            }}
            onPress={handlePress}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Nothing is in flow: each tab is placed on its own board centre, and the FAB — a later
  // sibling entirely — needs no slot reserved for it.
  pill: { justifyContent: 'center' },
  tab: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
}));
