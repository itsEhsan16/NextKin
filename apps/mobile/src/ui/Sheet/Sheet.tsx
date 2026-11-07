import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

import { SheetKeyboardLift } from './SheetKeyboardLift';
import { InSheetLayer } from './SheetLayer';
import { resolveSheetHeight } from './sheetLayout';
import { useSheetDismissPan } from './useSheetDismissPan';
import { useSheetProgress } from './useSheetProgress';

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
   * Fill `height` exactly instead of hugging content — for a sheet that scrolls internally and
   * pins its own footer (JOBS 04 Filters). Content measurement is skipped, so `height` clamped to
   * the screen below the top inset IS the sheet height, and the body can flex inside it. Without
   * this the measured column hugs its content and a `flex: 1` body would collapse to nothing.
   */
  fill?: boolean;
  /**
   * Swipe-down to dismiss. Turn OFF for a sheet whose body scrolls or contains its own horizontal
   * drag targets (the filter sheet's salary thumbs) — the dismiss pan would otherwise compete with
   * them for the gesture. The dismiss hierarchy survives: the close control, the scrim and Android
   * back all remain, so swipe is never the only exit either way.
   */
  swipeToDismiss?: boolean;
  /**
   * Lift the sheet above the keyboard. One text field per sheet - anything larger belongs on a
   * pushed <Screen keyboard> instead.
   */
  avoidKeyboard?: boolean;
  /**
   * Optional external progress (0 = closed, 1 = open). Lets other chrome — the FAB's "+ → ✕"
   * morph — animate from the exact same value so nothing drifts out of sync.
   */
  progress?: SharedValue<number>;
  showHandle?: boolean;
  accessibilityLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Bottom sheet primitive. Motion per the Figma annotation: springs in (damping ≈ 0.8, ~300ms,
 * slight overshoot), exits faster (~200ms); the scrim cross-fades from the same progress value.
 * Dismiss hierarchy: explicit close control (owner) > scrim tap > swipe-down — swipe is never
 * the only exit. Everything runs on the UI thread; React only learns about open/closed edges.
 *
 * Screen-reader isolation is a two-part contract — see sheetBackgroundA11yProps in sheetLayout.
 */
export function Sheet({
  open,
  onClose,
  height,
  fill = false,
  swipeToDismiss = true,
  avoidKeyboard = false,
  progress: externalProgress,
  showHandle = true,
  accessibilityLabel = 'Sheet',
  contentStyle,
  children,
}: SheetProps) {
  const { colors, radii, sizes, shadows, spacing, motion, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();

  const internalProgress = useSharedValue(0);
  const progress = externalProgress ?? internalProgress;
  const [mounted, setMounted] = useState(open);
  // The first content measurement of each opening lands while the sheet is still sliding up, and
  // springing to it made the sheet grow mid-entrance. That one is applied directly instead; the
  // flag re-arms when a close finishes, ready for the next opening.
  const firstMeasure = useRef(true);
  // Derived state: mount synchronously in the render that opens, unmount after the exit animation.
  if (open && !mounted) setMounted(true);

  const [contentHeight, setContentHeight] = useState(0);
  const targetHeight = resolveSheetHeight({
    designHeight: height,
    // A filling sheet owns its own scrolling, so its content never dictates the sheet height.
    contentHeight: fill ? 0 : contentHeight,
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

  const unmount = useCallback(() => {
    firstMeasure.current = true;
    setMounted(false);
  }, []);

  useSheetProgress({
    open,
    progress,
    reduced,
    avoidKeyboard,
    motion,
    onClosed: unmount,
  });

  useEffect(() => {
    if (firstMeasure.current && contentHeight > 0) {
      firstMeasure.current = false;
      animatedHeight.set(targetHeight);
      return;
    }
    // No-op on mount (the shared value already holds the target); animates on later changes.
    animatedHeight.set(
      withSpring(targetHeight, withReducedMotion(reduced, motion.springs.sheetIn)),
    );
  }, [animatedHeight, contentHeight, motion.springs.sheetIn, reduced, targetHeight]);

  // Android hardware back closes the sheet instead of popping the route underneath.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, open]);

  // `reduced` is JS-thread state, so the config is resolved here and the pan's worklets capture
  // a plain object; the gesture rebuilds off this identity whenever the setting flips.
  const snapBackSpring = useMemo(
    () => withReducedMotion(reduced, motion.springs.snappy),
    [motion.springs.snappy, reduced],
  );
  const pan = useSheetDismissPan({
    enabled: swipeToDismiss,
    progress,
    animatedHeight,
    onClose,
    snapBackSpring,
    motionSheet: motion.sheet,
  });

  // The surface runs `bleed` past the bottom edge (and pads its content up by as much), so the
  // open spring's overshoot lifts more sheet into view rather than a strip of scrim under it.
  const bleed = motion.sheet.overshootBleed;
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value + bleed,
    transform: [{ translateY: (1 - progress.value) * animatedHeight.value }],
  }));

  if (!mounted) return <InSheetLayer node={null} />;

  // Only this subtree lifts; the transform is outer, so sheetStyle and the drag maths are untouched.
  const sheet = (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.sheet,
          {
            bottom: -bleed,
            paddingBottom: insets.bottom + bleed,
            backgroundColor: colors.surfaceSheet,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
          },
          shadows.sheet,
          sheetStyle,
        ]}
      >
        {/* Measured column: whatever this reports is the height the sheet must be able to show. */}
        <View
          onLayout={fill ? undefined : measureContent}
          style={fill ? styles.fill : styles.column}
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
                  marginTop: spacing[3],
                },
              ]}
            />
          ) : null}
          <View style={[fill ? styles.fill : null, contentStyle]}>{children}</View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
  // Both platforms. Android used to be left to `adjustResize`, which an edge-to-edge window
  // (mandatory since SDK 54) never does, so the keyboard sat over the sheet's field.
  // The keyboard controller reports the keyboard on both, and the lift subtracts the bottom inset.
  const lifted = avoidKeyboard;

  // Drawn in the page's sheet layer, over the whole window, wherever the sheet is written (§174).
  return (
    <InSheetLayer
      node={
        // The modal flag sits on the overlay root rather than the sheet surface: on the surface it
        // hides its own sibling — the scrim's "Close sheet" target — from VoiceOver while leaving
        // the page behind it fully reachable, which is exactly backwards.
        // `zIndex.sheet` is load-bearing, not decoration. The token existed and was never applied, so
        // the overlay sat at an implicit 0 while `StickyActionBar` declares 10 — and an explicit
        // z-index beats document order. Every sheet raised over a page with a pinned bar was therefore
        // painted *under* that bar: on the profile forms the page's "Save" covered the bottom of the
        // date picker's own "Done", and the scrim never dimmed it.
        <View
          accessibilityViewIsModal
          style={[StyleSheet.absoluteFill, { zIndex: zIndex.sheet }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {lifted ? (
            <SheetKeyboardLift sheetHeight={animatedHeight}>{sheet}</SheetKeyboardLift>
          ) : (
            sheet
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  // The column hugs its content so onLayout reports the content's natural height rather than
  // the sheet's (a flex:1 child would just echo the sheet height back and never grow it).
  column: { position: 'absolute', left: 0, right: 0, top: 0 },
  // `fill` mode instead: the body stretches to the sheet's own height and scrolls inside it.
  fill: { flex: 1 },
  handle: { alignSelf: 'center' },
});
