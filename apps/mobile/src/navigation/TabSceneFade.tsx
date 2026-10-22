import { useEffect, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

/** The slice of a tab route's navigation object the fade needs. */
type TabSceneNavigation = {
  addListener: (type: 'focus' | 'blur', callback: () => void) => () => void;
  getState: () => { index: number; routes: readonly { key: string }[] };
  isFocused: () => boolean;
};

export type TabSceneFadeProps = {
  navigation: TabSceneNavigation;
  routeKey: string;
  children: ReactElement;
};

/**
 * Fades a tab's scene in when the user switches to it, in step with the tab bar's own 180 ms
 * cross-fade.
 *
 * Done here rather than with the navigator's `animation: 'fade'` on purpose: that option turns an
 * unfocused tab's activity state into an Animated value, which silently disables `freezeOnBlur`,
 * so every hidden tab would re-render on each app update. This keeps the freeze.
 *
 * Only a real tab switch fades. A tab also blurs when a stack screen is pushed over it, and is
 * visible again while that screen pops — so a blur hides the scene only when the tab navigator
 * itself moved to another tab. The scene is already transparent when it is shown again, so the
 * first frame can never flash at full opacity before the fade starts.
 */
export function TabSceneFade({ navigation, routeKey, children }: TabSceneFadeProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      opacity.set(1);
      return;
    }
    const fadeIn = () => opacity.set(withTiming(1, motion.timings.tabSwitch));
    const offFocus = navigation.addListener('focus', fadeIn);
    const offBlur = navigation.addListener('blur', () => {
      const state = navigation.getState();
      if (state.routes[state.index]?.key !== routeKey) opacity.set(0);
    });
    // A scene that mounts already focused (the launch tab) may have had its first focus event
    // emitted before this listener existed; it must never be left transparent.
    if (navigation.isFocused()) fadeIn();
    return () => {
      offFocus();
      offBlur();
    };
  }, [motion.timings.tabSwitch, navigation, opacity, reduced, routeKey]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View testID="tab-scene" style={[styles.scene, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
