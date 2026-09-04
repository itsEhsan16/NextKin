import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ColorToken } from '@/theme';

/**
 * One line of the fake document page, as fractions of the Figma 204×200 thumbnail
 * (RESUMES 01, 1:1400) so the same pattern draws crisply at 48pt in the menu sheet and
 * 160pt in the first-run illustration.
 */
type Bar = { top: number; height: number; width: number; tone: ColorToken };

const bar = (y: number, h: number, w: number, tone: ColorToken): Bar => ({
  top: y / 200,
  height: h / 200,
  width: w / 204,
  tone,
});

const BARS: readonly Bar[] = [
  bar(21, 7, 80, 'surfaceSelected'), // name
  bar(34, 4, 112, 'borderDashed'), // headline
  bar(53, 3, 144, 'borderDefault'),
  bar(62, 3, 118, 'borderDefault'),
  bar(71, 3, 150, 'borderDefault'),
  bar(80, 3, 99, 'borderDefault'),
  bar(92, 5, 51, 'iconMuted'), // section heading
  bar(107, 3, 138, 'borderDefault'),
  bar(116, 3, 125, 'borderDefault'),
  bar(125, 3, 147, 'borderDefault'),
  bar(134, 3, 106, 'borderDefault'),
  bar(146, 5, 51, 'iconMuted'),
  bar(161, 3, 141, 'borderDefault'),
  bar(170, 3, 112, 'borderDefault'),
];

const LEFT = 21 / 204;

export type ResumeThumbnailProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * The stylised resume page every document card draws. Vector, not an image, so it scales to
 * any slot and follows the theme. The caller owns the frame (border, radius, size); overlays
 * like the "Update available" pill sit on top of it in the caller too.
 */
export function ResumeThumbnail({ style }: ResumeThumbnailProps) {
  const { colors, s } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.page, { backgroundColor: colors.surfaceCard }, style]}
    >
      {BARS.map((line, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: `${LEFT * 100}%`,
            top: `${line.top * 100}%`,
            width: `${line.width * 100}%`,
            height: `${Math.max(1.2, line.height * 100)}%`,
            maxHeight: s(7),
            borderRadius: s(2),
            backgroundColor: colors[line.tone],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
});
