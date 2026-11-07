import { memo, useCallback, useEffect, type FC } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import { a11yHiddenWhen } from '@/lib';
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
  const { colors, motion } = useTheme();
  const styles = useStyles();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, motion.timings.tabSwitch));
  }, [active, focused, motion.timings.tabSwitch]);

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
      <View style={{ width: iconWidth, height: iconHeight }}>
        <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
          <Icon width={iconWidth} height={iconHeight} color={colors.tabInactive} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          <IconActive width={iconWidth} height={iconHeight} color={colors.tabActive} />
        </Animated.View>
      </View>
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
