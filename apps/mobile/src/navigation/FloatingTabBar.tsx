import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useCallback, useEffect, useRef, type FC } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import HomeIcon from '../../assets/icons/nav/home.svg';
import JobsIcon from '../../assets/icons/nav/jobs.svg';
import ProfileIcon from '../../assets/icons/nav/profile.svg';
import ResumesIcon from '../../assets/icons/nav/resumes.svg';
import { haptics } from '@/lib';
import { useLayoutScale, useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** `w`/`h` are the Figma icon boxes — each glyph has its own aspect ratio, so they are not square. */
type TabMeta = { label: string; Icon: FC<SvgProps>; w: number; h: number };

/** Route name (file) → presentation. Order comes from the navigator state. */
const TABS: Record<string, TabMeta> = {
  // Figma nodes 77:4 / 77:8 / 77:16 / 77:22 (matches each SVG's intrinsic size).
  index: { label: 'Home', Icon: HomeIcon, w: 20.4975, h: 23.885 },
  jobs: { label: 'Jobs', Icon: JobsIcon, w: 22.6085, h: 21.7917 },
  resumes: { label: 'Resumes', Icon: ResumesIcon, w: 21.1013, h: 18.7122 },
  profile: { label: 'Profile', Icon: ProfileIcon, w: 21.1013, h: 21.1013 },
};

/** Index after which the FAB slot is inserted (2 tabs | FAB | 2 tabs). */
const FAB_SLOT_AFTER = 1;

/**
 * Floor for icon shrinkage, as a fraction of the designed size — glyphs stay legible on narrow
 * screens. Applied to width and height alike so the aspect ratio survives the clamp.
 */
const ICON_MIN_RATIO = 18 / 21;

type TabItemProps = {
  routeKey: string;
  label: string;
  Icon: FC<SvgProps>;
  focused: boolean;
  iconWidth: number;
  iconHeight: number;
  onPress: (routeKey: string) => void;
  onLongPress: (routeKey: string) => void;
};

/**
 * Memoised: each tab renders TWO SVG trees for the colour cross-fade, so an unmemoised item
 * would put eight SVG re-renders in the same frame as every navigation transition. All props
 * are primitives or module-level constants, and the handlers are stable, so only the two tabs
 * whose `focused` actually flipped re-render.
 */
const TabItem = memo(function TabItem({
  routeKey,
  label,
  Icon,
  focused,
  iconWidth,
  iconHeight,
  onPress,
  onLongPress,
}: TabItemProps) {
  const { colors, motion } = useTheme();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, motion.timings.tabSwitch));
  }, [active, focused, motion.timings.tabSwitch]);

  // Two tinted copies cross-fade on the UI thread — SVG fills can't interpolate colour directly.
  const activeStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));

  const handlePress = useCallback(() => onPress(routeKey), [onPress, routeKey]);
  const handleLongPress = useCallback(() => onLongPress(routeKey), [onLongPress, routeKey]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      feedback="subtle"
      haptic="none"
      onPress={handlePress}
      onLongPress={handleLongPress}
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
 * Floating pill tab bar from the Home artboard. Rendered by the Tabs navigator via `tabBar`;
 * the FAB itself is a sibling above the create sheet (see `(tabs)/_layout.tsx`), so this bar
 * only reserves the centre slot.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, shadows } = useTheme();
  const layout = useTabBarLayout();
  const { s } = useLayoutScale();

  // The navigator hands us a new `state` object on every transition. Read it through a ref so
  // the press handlers keep a stable identity and the memoised tabs stay put.
  const live = useRef({ state, navigation });
  useEffect(() => {
    live.current = { state, navigation };
  });

  const handlePress = useCallback((routeKey: string) => {
    const { state: navState, navigation: nav } = live.current;
    const route = navState.routes.find((candidate) => candidate.key === routeKey);
    if (!route) return;
    const focused = navState.routes[navState.index]?.key === routeKey;

    const event = nav.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptics.selection();
      nav.navigate(route.name, route.params);
    }
  }, []);

  const handleLongPress = useCallback((routeKey: string) => {
    live.current.navigation.emit({ type: 'tabLongPress', target: routeKey });
  }, []);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: layout.bottomOffset }]}
      // The bar floats; content scrolls underneath (Screen reserves the inset).
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
        {state.routes.flatMap((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return [];

          const item = (
            <TabItem
              key={route.key}
              routeKey={route.key}
              label={descriptors[route.key]?.options.title ?? meta.label}
              Icon={meta.Icon}
              focused={state.index === index}
              iconWidth={s(meta.w, meta.w * ICON_MIN_RATIO)}
              iconHeight={s(meta.h, meta.h * ICON_MIN_RATIO)}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
          );
          // Centre slot is reserved for the FAB, which renders above the sheet scrim.
          return index === FAB_SLOT_AFTER ? [item, <View key="fab-slot" style={styles.fabSlot} />] : [item];
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', gap: 3 },
  fabSlot: { flex: 1 },
});
