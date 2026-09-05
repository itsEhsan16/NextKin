/**
 * The Sheet's swipe-down-to-dismiss pan, split out of Sheet.tsx when the keyboard lift pushed
 * that file past the size guideline. Behaviour is unchanged.
 */
import { useMemo } from 'react';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

import type { Theme } from '@/theme';

export type SheetDismissPanInput = {
  /** `swipeToDismiss`: off for sheets whose body scrolls or drags horizontally. */
  enabled: boolean;
  progress: SharedValue<number>;
  animatedHeight: SharedValue<number>;
  onClose: () => void;
  /** Already resolved against `useReducedMotion()` on the JS thread. */
  snapBackSpring: WithSpringConfig;
  motionSheet: Theme['motion']['sheet'];
};

export function useSheetDismissPan({
  enabled,
  progress,
  animatedHeight,
  onClose,
  snapBackSpring,
  motionSheet,
}: SheetDismissPanInput): PanGesture {
  // Rebuilding the gesture on every render makes GestureDetector re-attach its handlers, so it
  // is memoised on everything the worklets capture (the documented RNGH pattern).
  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
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
            event.velocityY > motionSheet.swipeDismissVelocity ||
            event.translationY > animatedHeight.value * motionSheet.swipeDismissFraction;
          if (shouldDismiss) {
            runOnJS(onClose)();
          } else {
            progress.set(withSpring(1, snapBackSpring));
          }
        }),
    [
      animatedHeight,
      enabled,
      motionSheet.swipeDismissFraction,
      motionSheet.swipeDismissVelocity,
      onClose,
      progress,
      snapBackSpring,
    ],
  );
}
