import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityProps,
  type LayoutChangeEvent,
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
  /**
   * Design height in px, excluding the bottom safe-area inset. Treated as a FLOOR: the sheet
   * grows past it whenever its content is taller (narrow screens wrap text, Dynamic Type
   * enlarges it), because a fixed height plus overflow:'hidden' would silently clip rows —
   * and a clipped row is untappable on Android. Changing it morphs the sheet on the UI thread
   * (the CREATE 01 -> 02 push shrinks 600 -> 520).
   */
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

export type SheetHeightInput = {
  /** The artboard height for this sheet, excluding safe-area insets. */
  designHeight: number;
  /** Measured height of the sheet's own content column; 0 before the first layout pass. */
  contentHeight: number;
  insetBottom: number;
  insetTop: number;
  windowHeight: number;
};

/**
 * The design height is a FLOOR, not a fixed size.
 *
 * Figma artboards are 520pt wide; on a narrower phone the sheet's text wraps and the row stack
 * outgrows the scaled artboard height. Because the sheet clips (overflow: 'hidden'), a fixed
 * height would silently cut the last row off — and a clipped row is untappable on Android. So
 * the sheet takes whichever is taller, and never exceeds the screen below the top inset.
 */
export function resolveSheetHeight({
  designHeight,
  contentHeight,
  insetBottom,
  insetTop,
  windowHeight,
}: SheetHeightInput): number {
  const maxHeight = windowHeight - insetTop;
  const wanted = Math.max(designHeight, contentHeight) + insetBottom;
  return Math.min(maxHeight, wanted);
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
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();

  const internalProgress = useSharedValue(0);
  const progress = externalProgress ?? internalProgress;
  const [mounted, setMounted] = useState(open);
  // Derived state: mount synchronously in the render that opens, unmount after the exit animation.
  if (open && !mounted) setMounted(true);

  const [contentHeight, setContentHeight] = useState(0);
  const targetHeight = resolveSheetHeight({
    designHeight: height,
    contentHeight,
    insetBottom: insets.bottom,
    insetTop: insets.top,
    windowHeight,
  });
  // Animating the height (rather than re-laying out) keeps the morph on the UI thread and lets
  // the drag maths read the live value.
  const animatedHeight = useSharedValue(targetHeight);

  const measureContent = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.ceil(event.nativeEvent.layout.height);
    setContentHeight((current) => (current === measured ? current : measured));
  }, []);

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

  useEffect(() => {
    // No-op on mount (the shared value already holds the target); animates on later changes.
    animatedHeight.set(withSpring(targetHeight, withReducedMotion(reduced, motion.springs.sheetIn)));
  }, [animatedHeight, motion.springs.sheetIn, reduced, targetHeight]);

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
          progress.set(Math.max(0, 1 - event.translationY / animatedHeight.value));
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.velocityY > motion.sheet.swipeDismissVelocity ||
            event.translationY > animatedHeight.value * motion.sheet.swipeDismissFraction;
          if (shouldDismiss) {
            runOnJS(onClose)();
          } else {
            progress.set(withSpring(1, snapBackSpring));
          }
        }),
    [
      animatedHeight,
      motion.sheet.swipeDismissFraction,
      motion.sheet.swipeDismissVelocity,
      onClose,
      progress,
      snapBackSpring,
    ],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    transform: [{ translateY: (1 - progress.value) * animatedHeight.value }],
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
              paddingBottom: insets.bottom,
              backgroundColor: colors.surfaceSheet,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
            },
            shadows.sheet,
            sheetStyle,
          ]}
        >
          {/* Measured column: whatever this reports is the height the sheet must be able to show. */}
          <View onLayout={measureContent} style={styles.column}>
            {showHandle ? (
              <View
                style={[
                  styles.handle,
                  {
                    width: sizes.grabHandleWidth,
                    height: sizes.grabHandleHeight,
                    borderRadius: radii.full,
                    backgroundColor: colors.grabHandle,
                    marginTop: spacing[3],
                  },
                ]}
              />
            ) : null}
            <View style={contentStyle}>{children}</View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  // The column hugs its content so onLayout reports the content's natural height rather than
  // the sheet's (a flex:1 child would just echo the sheet height back and never grow it).
  column: { position: 'absolute', left: 0, right: 0, top: 0 },
  handle: { alignSelf: 'center' },
});
