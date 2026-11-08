import { memo, useCallback, useEffect, useRef, type FC } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import { a11yHiddenWhen, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { TabName } from './tabScroll';

export type TabBarItemProps = {
  name: TabName;
  label: string;
  Icon: FC<SvgProps>;
  IconActive: FC<SvgProps>;
  focused: boolean;
  iconWidth: number;
  iconHeight: number;
  /** Absolute slot inside the pill, centred on the tab’s board position. Must be memoised. */
  slot: ViewStyle;
  onPress: (name: TabName) => void;
};

/**
 * Memoised: each tab renders TWO SVG trees and two labels for the colour cross-fade, so an
 * unmemoised item would put eight SVG re-renders in the same frame as every navigation
 * transition. The bar passes primitives, module-level constants, a stable handler and a
 * memoised slot, so only the two tabs whose `focused` actually flipped re-render.
 */
export const TabBarItem = memo(function TabBarItem({
  name,
  label,
  Icon,
  IconActive,
  focused,
  iconWidth,
  iconHeight,
  slot,
  onPress,
}: TabBarItemProps) {
  const { colors, motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);
  // No pop for the tab that is simply selected when the app opens; only for a switch to it.
  const mounted = useRef(false);

  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, motion.timings.tabSwitch));
    // The tab just chosen gives one small pop as the light arrives under it (§192).
    if (focused && !reduced && mounted.current) {
      pop.set(
        withSequence(withTiming(1.14, motion.timings.press), withSpring(1, motion.springs.gentle)),
      );
    }
    mounted.current = true;
  }, [active, focused, motion, pop, reduced]);

  const lift = reduced ? 0 : s(LIFT);
  // The selected icon rides a little higher, so the tab reads as raised, not just recoloured.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift * active.value }, { scale: pop.value }],
  }));

  // Icon cuts and labels cross-fade on the UI thread. SVG paths cannot be interpolated, and a
  // hard swap reads as a flicker at this size; the label fades with them so nothing snaps.
  const activeStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));

  const handlePress = useCallback(() => onPress(name), [onPress, name]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      feedback="subtle"
      onPress={handlePress}
      style={[styles.tab, slot]}
    >
      <Animated.View style={[{ width: iconWidth, height: iconHeight }, iconStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
          <Icon width={iconWidth} height={iconHeight} color={colors.tabInactive} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          <IconActive width={iconWidth} height={iconHeight} color={colors.tabActive} />
        </Animated.View>
      </Animated.View>
      {/* The grey copy holds the layout; the violet one sits exactly over it. */}
      <View>
        <Animated.View style={inactiveStyle} {...a11yHiddenWhen(focused)}>
          <Text variant="tabLabel" color="tabInactive" align="center" numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFill, activeStyle]}
          pointerEvents="none"
          {...a11yHiddenWhen(!focused)}
        >
          <Text variant="tabLabel" color="tabActive" align="center" numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

/** How far the selected icon rises, in board units. */
const LIFT = 2;

const useStyles = scaledSheet((s) => ({
  tab: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
}));
