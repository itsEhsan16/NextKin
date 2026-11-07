import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { useSelectionProgress } from '@/ui/motion';

export type FieldChromeColors = {
  /** The box's edge at rest. */
  rest: string;
  /** The edge while the input holds focus. */
  focused?: string;
  /** The edge while an error stands. */
  error?: string;
};

/**
 * What every text box in the app owes its user, whatever it looks like: an edge that answers
 * focus, and an error that fades in and is said out loud once (no vibration, §191).
 * `TextField`, `SearchField` and the auth boxes share it, so none of them can ship without a
 * visible focus again — the auth and search boxes had none.
 *
 * The border is owned by one animated style, error included. React only owns `borderColor` until
 * the first updater run; after that Reanimated re-applies it over every commit, so a static
 * override later in the style array would stop winning the moment the field was focused.
 */
export function useFieldChrome(error: string | undefined, colors: FieldChromeColors) {
  const { colors: palette, motion } = useTheme();
  const reduced = useReducedMotion();

  // Resolved on the JS side: the worklet captures these by value, and a token read from inside
  // it would come off the UI runtime's copy of the theme rather than this render's.
  const rest = colors.rest;
  const focused = colors.focused ?? palette.surfaceSelected;
  const failed = colors.error ?? palette.danger;

  const focus = useSharedValue(0);
  const errorProgress = useSelectionProgress(Boolean(error));
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      errorProgress.value,
      [0, 1],
      [interpolateColor(focus.value, [0, 1], [rest, focused]), failed],
    ),
  }));

  // Once per falsy→truthy transition. Announced explicitly because iOS has no live region, and
  // re-announcing on every keystroke while the same error stands would talk over the user typing
  // the fix.
  const previousError = useRef<string | undefined>(undefined);
  useEffect(() => {
    const wasShowing = Boolean(previousError.current);
    previousError.current = error;
    if (!error || wasShowing) return;
    AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  return {
    borderStyle,
    onFocus: () => focus.set(withTiming(1, withReducedMotion(reduced, motion.timings.fast))),
    onBlur: () => focus.set(withTiming(0, withReducedMotion(reduced, motion.timings.fast))),
  };
}
