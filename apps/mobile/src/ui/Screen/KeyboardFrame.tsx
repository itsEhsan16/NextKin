import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

export type KeyboardFrameProps = {
  /** The bottom strip the keyboard may cover — see `keyboardBottomReserve`. */
  reserve: number;
  children: ReactNode;
};

/**
 * The keyboard-avoiding wrapper of a `Screen keyboard` page, split out of Screen.tsx.
 *
 * `react-native-keyboard-controller`'s avoider (in Expo Go since SDK 57) pads the page by the
 * keyboard's height on the UI thread, frame by frame, on both platforms — so the page, its pinned
 * footer and the focused field travel WITH the keyboard. React Native's own avoider padded only
 * once the keyboard had finished opening on Android, so everything snapped up after it.
 *
 * Only the flex lives out here, never the page's safe-area box: `behavior="padding"` composes the
 * keyboard's height over the style it is handed, which would drop a bottom inset there. Inside, the
 * `flex: 1` box shrinks to match, carrying the footer up.
 *
 * `keyboardVerticalOffset` is negative by `reserve`: the bottom safe-area strip is dead space once
 * the keyboard covers the home indicator, so the keyboard slides over it rather than pushing it up.
 * That is what keeps a footer's buttons `spacing[4]` above the keys without the footer changing its
 * own padding when the keyboard moves (it used to, a beat late, on `keyboardDidShow`).
 */
export function KeyboardFrame({ reserve, children }: KeyboardFrameProps) {
  return (
    <KeyboardAvoidingView
      testID="screen-keyboard-avoider"
      style={styles.root}
      behavior="padding"
      keyboardVerticalOffset={-reserve}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
