import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';

export type DialogProps = {
  open: boolean;
  /** Every dismiss path: the scrim, Android back, and the dialog's own ✕ or "Not now". */
  onClose: () => void;
  accessibilityLabel: string;
  children: ReactNode;
};

// TAILOR 00c's dialog at 390 (634:633), in artboard units.
const INSET = 24 / 0.75;
const RADIUS = 26 / 0.75;

/**
 * A centred card over a scrim — the one place the app asks a question out of the blue (TAILOR
 * 00c) rather than from a tap. Sheet's contract, centred: it springs in from a slight shrink with
 * the scrim fading on the same progress, exits faster, and closes from the scrim and Android back
 * as well as from its own controls. Only the overlay root is modal for screen readers, as on Sheet.
 */
export function Dialog({ open, onClose, accessibilityLabel, children }: DialogProps) {
  const { colors, shadows, motion, zIndex } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(open);
  // Mount in the render that opens; unmount once the exit has run.
  if (open && !mounted) setMounted(true);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (open) {
      // Critically damped (§196): the card settles at full size instead of overshooting it.
      progress.set(withSpring(1, withReducedMotion(reduced, motion.springs.dialogIn)));
      return;
    }
    progress.set(
      withTiming(0, withReducedMotion(reduced, motion.timings.sheetOut), (finished) => {
        if (finished) runOnJS(unmount)();
      }),
    );
  }, [motion.springs.dialogIn, motion.timings.sheetOut, open, progress, reduced, unmount]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, open]);

  const exitScale = motion.scales.dialogFrom;
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [exitScale, 1]) }],
  }));

  if (!mounted) return null;

  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.center, { zIndex: zIndex.sheet }]}
      // Closing, it takes no taps (§196), so a button tapped during the exit can't fire twice.
      pointerEvents={open ? 'box-none' : 'none'}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceSheet,
            marginTop: insets.top,
            marginBottom: insets.bottom,
          },
          shadows.dialog,
          cardStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  center: { justifyContent: 'center', paddingHorizontal: s(INSET) },
  card: { borderRadius: s(RADIUS) },
}));
