/**
 * Translates an open Sheet up over the iOS keyboard (Phase 9A).
 *
 * A separate component mounted conditionally rather than a hook inside `Sheet`, because
 * Reanimated's `useAnimatedKeyboard` takes the app off Android's `adjustResize` for as long as
 * it is mounted — it switches the window to `adjustNothing` and hands the offset to the UI
 * thread instead. Six hosts render a `<Sheet open={false}>` unconditionally, so a hook inside
 * Sheet would run app-wide and quietly break keyboard handling on every Android screen. Mounted
 * here, it runs only for an opted-in, actually-mounted, iOS sheet.
 */
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keyboardLift } from './sheetKeyboardMath';

export type SheetKeyboardLiftProps = {
  /** The sheet's live height, so the lift can stop before the sheet's top clears the notch. */
  sheetHeight: SharedValue<number>;
  children: ReactNode;
};

export function SheetKeyboardLift({ sheetHeight, children }: SheetKeyboardLiftProps) {
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Read here so the worklet captures plain numbers rather than the insets object.
  const insetBottom = insets.bottom;
  const insetTop = insets.top;

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -keyboardLift({
          keyboardHeight: keyboard.height.value,
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
