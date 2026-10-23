/**
 * Translates an open Sheet up over the keyboard (Phase 9A), on both platforms.
 *
 * Driven by `react-native-keyboard-controller`'s animated keyboard height — the same source the
 * pages' `KeyboardFrame` uses — so the app has ONE keyboard system. (It used Reanimated's
 * `useAnimatedKeyboard`, which switches Android's soft-input mode while mounted and would contend
 * with the controller's provider.) Still a separate, conditionally mounted component: six hosts
 * render a `<Sheet open={false}>` unconditionally, and only an opted-in, mounted sheet needs it.
 */
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keyboardLift } from './sheetKeyboardMath';

export type SheetKeyboardLiftProps = {
  /** The sheet's live height, so the lift can stop before the sheet's top clears the notch. */
  sheetHeight: SharedValue<number>;
  children: ReactNode;
};

export function SheetKeyboardLift({ sheetHeight, children }: SheetKeyboardLiftProps) {
  // `height` runs from 0 to MINUS the keyboard's height as it opens, frame by frame.
  const keyboard = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Read here so the worklet captures plain numbers rather than the insets object.
  const insetBottom = insets.bottom;
  const insetTop = insets.top;

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -keyboardLift({
          keyboardHeight: -keyboard.height.value,
          sheetHeight: sheetHeight.value,
          insetBottom,
          insetTop,
          windowHeight,
        }),
      },
    ],
  }));

  return (
    // box-none: the lift covers the whole overlay but must not swallow taps meant for the scrim
    // underneath it.
    <Animated.View
      testID="sheet-keyboard-lift"
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, liftStyle]}
    >
      {children}
    </Animated.View>
  );
}
