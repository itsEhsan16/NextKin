import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { fontScaleFor, textStyles, type TextProps } from './Text';

export type AnimatedTextProps = Omit<TextProps, 'color'> & {
  /**
   * The colour, as an animated style from `useAnimatedStyle` — e.g. `interpolateColor` between two
   * tokens on a selection's progress. Colour only; the role still sets everything else.
   */
  colorStyle: AnimatedStyle<TextStyle>;
};

/**
 * `Text` whose colour can move on the UI thread: the same type ramp, Dynamic Type caps and font
 * padding, with the colour handed in as an animated style. For a label whose colour changes with
 * a state — a chip's label fading to white as its fill fades to ink — where a plain `Text` could
 * only switch it at once, out of step with everything around it.
 */
export function AnimatedText({
  variant = 'body',
  align,
  style,
  colorStyle,
  maxFontSizeMultiplier,
  ...rest
}: AnimatedTextProps) {
  const theme = useTheme();
  const roleStyle = useMemo<TextStyle>(
    () => ({ ...theme.typography[variant], ...(align ? { textAlign: align } : {}) }),
    [theme, variant, align],
  );

  return (
    <Animated.Text
      {...rest}
      maxFontSizeMultiplier={fontScaleFor(variant, maxFontSizeMultiplier)}
      style={[textStyles.base, roleStyle, colorStyle, style]}
    />
  );
}
