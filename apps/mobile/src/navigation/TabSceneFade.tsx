import { useEffect, useState, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

/**
 * Whether the app's first tab scene has mounted. The tab navigator is mounted once per sign-in,
 * so only the very first scene counts as the launch.
 */
let launched = false;

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
 * Done here rather than with the navigator's `animation: 'fade'` on purpose: on SDK 57 that option
 * turned an unfocused tab's activity state into an Animated value, which silently disabled
 * `freezeOnBlur`. (Expo Router 58 no longer freezes tabs at all; see toreview §138.)
 *
 * Only a real tab switch fades. A tab also blurs when a stack screen is pushed over it, and is
 * visible again while that screen pops — so a blur hides the scene only when the tab navigator
 * itself moved to another tab. The scene is already transparent when it is shown again, so the
 * first frame can never flash at full opacity before the fade starts.
 */
export function TabSceneFade({ navigation, routeKey, children }: TabSceneFadeProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  // The tab on screen at launch starts visible (§196): the splash has just faded out, and a
  // second fade of the same page from blank would read as a flicker. A tab first opened later
  // (lazily mounted, already focused) still fades in like every other switch.
  const [launchScene] = useState(() => {
    const first = !launched && navigation.isFocused();
    launched = true;
    return first;
  });
  const opacity = useSharedValue(reduced || launchScene ? 1 : 0);

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
