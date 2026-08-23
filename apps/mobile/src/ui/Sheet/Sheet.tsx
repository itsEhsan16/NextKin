import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

export type SheetProps = {
  open: boolean;
  /** Called for every dismiss path: scrim tap, swipe-down, Android back. */
  onClose: () => void;
  /** Sheet height in px (excluding the bottom safe-area inset, which is added). */
  height: number;
  /**
   * Optional external progress (0 = closed, 1 = open). Lets other chrome — the FAB's "+ → ✕"
   * morph — animate from the exact same value so nothing drifts out of sync.
   */
  progress?: SharedValue<number>;
  showHandle?: boolean;
  /** Haptic on open. Figma motion note: "light haptic on open". */
  hapticOnOpen?: boolean;
  accessibilityLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Modal-isolation contract for sheet hosts.
 *
 * accessibilityViewIsModal only hides the *siblings* of the view that sets it, and Android
 * ignores it outright — so the Sheet alone cannot make the screen behind it inert for a
 * screen reader. The Sheet marks its own overlay root modal (which covers iOS whenever the
 * sheet is mounted alongside the page content); the host must additionally spread these props
 * onto the background subtree it owns — the tabs layout's screen container — while the sheet
 * is open, or that content stays swipe-navigable under the sheet on Android.
 *
 * Usage: spread onto the background wrapper, e.g.
 * <View {...sheetBackgroundA11yProps(sheetOpen)}>{screens}</View>, with the Sheet rendered as
 * a sibling after it.
 */
export function sheetBackgroundA11yProps(
  sheetOpen: boolean,
): Pick<AccessibilityProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> {
  return sheetOpen
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
    : { accessibilityElementsHidden: false, importantForAccessibility: 'auto' };
}

/**
 * Bottom sheet primitive. Motion per the Figma annotation: springs in (damping ≈ 0.8, ~300ms,
 * slight overshoot), exits faster (~200ms); the scrim cross-fades from the same progress value.
 * Dismiss hierarchy: explicit close control (owner) > scrim tap > swipe-down — swipe is never
 * the only exit. Everything runs on the UI thread; React only learns about open/closed edges.
 *
 * Screen-reader isolation is a two-part contract — see sheetBackgroundA11yProps above.
 */
export function Sheet({
  open,
  onClose,
  height,
  progress: externalProgress,
  showHandle = true,
  hapticOnOpen = true,
  accessibilityLabel = 'Sheet',
  contentStyle,
  children,
}: SheetProps) {
  const { colors, radii, sizes, shadows, spacing, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const internalProgress = useSharedValue(0);
  const progress = externalProgress ?? internalProgress;
  const [mounted, setMounted] = useState(open);
  // Derived state: mount synchronously in the render that opens, unmount after the exit animation.
  if (open && !mounted) setMounted(true);

  const totalHeight = height + insets.bottom;

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (open) {
      if (hapticOnOpen) haptics.light();
      progress.set(withSpring(1, withReducedMotion(reduced, motion.springs.sheetIn)));
      return;
    }
    progress.set(
      withTiming(0, withReducedMotion(reduced, motion.timings.sheetOut), (finished) => {
        if (finished) runOnJS(unmount)();
      }),
    );
  }, [hapticOnOpen, motion.springs.sheetIn, motion.timings.sheetOut, open, progress, reduced, unmount]);

  // Android hardware back closes the sheet instead of popping the route underneath.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, open]);

  // `reduced` is JS-thread state, so the config is resolved here and the worklet captures a
  // plain object; the memo below rebuilds the gesture whenever the setting flips.
  const snapBackSpring = useMemo(
    () => withReducedMotion(reduced, motion.springs.snappy),
    [motion.springs.snappy, reduced],
  );

  // Rebuilding the gesture on every render makes GestureDetector re-attach its handlers, so it
  // is memoised on everything the worklets capture (the documented RNGH pattern).
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onUpdate((event) => {
          if (event.translationY <= 0) {
            progress.set(1);
            return;
          }
          progress.set(Math.max(0, 1 - event.translationY / totalHeight));
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.velocityY > motion.sheet.swipeDismissVelocity ||
            event.translationY > totalHeight * motion.sheet.swipeDismissFraction;
          if (shouldDismiss) {
            runOnJS(onClose)();
          } else {
            progress.set(withSpring(1, snapBackSpring));
          }
        }),
    [
      motion.sheet.swipeDismissFraction,
      motion.sheet.swipeDismissVelocity,
      onClose,
      progress,
      snapBackSpring,
      totalHeight,
    ],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * totalHeight }],
  }));

  if (!mounted) return null;

  return (
    // The modal flag sits on the overlay root rather than the sheet surface: on the surface it
    // hides its own sibling — the scrim's "Close sheet" target — from VoiceOver while leaving
    // the page behind it fully reachable, which is exactly backwards.
    <View accessibilityViewIsModal style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            {
              height: totalHeight,
              paddingBottom: insets.bottom,
              backgroundColor: colors.surfaceSheet,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
            },
            shadows.sheet,
            sheetStyle,
          ]}
        >
          {showHandle ? (
            <View
              style={[
                styles.handle,
                {
                  width: sizes.grabHandleWidth,
                  height: sizes.grabHandleHeight,
                  borderRadius: radii.full,
                  backgroundColor: colors.grabHandle,
                  marginTop: spacing[2],
                },
              ]}
            />
          ) : null}
          <View style={[styles.content, contentStyle]}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  handle: { alignSelf: 'center' },
  content: { flex: 1 },
});
