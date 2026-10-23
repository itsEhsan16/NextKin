import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import StrongSparkleIcon from '../../../../assets/icons/score/strong-sparkle.svg';
import { ATS_BAND_LABEL, type AtsBand } from '@/data/models';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

export type ScoreBandPillProps = {
  band: AtsBand;
  style?: StyleProp<ViewStyle>;
};

/** "Strong match" (Figma 533:2): 22.5 tall, sparkle 7 in, label 2.75 after it, at 390. */
const PAD_LEFT = 7 / 0.75;
const PAD_RIGHT = 14;
const PAD_Y = 5;
const GAP = 2.75 / 0.75;
const SPARKLE = { w: 15 / 0.75, h: 14.59 / 0.75 } as const;

const BAND_SURFACE: Record<AtsBand, ColorToken> = {
  strong: 'successSurface',
  good: 'warningSurface',
  fair: 'dangerSurface',
  weak: 'dangerSurface',
};

const BAND_TEXT: Record<AtsBand, ColorToken> = {
  strong: 'success',
  good: 'warningStrong',
  fair: 'danger',
  weak: 'danger',
};

/**
 * The band under the RESUMES 04 ring. The board draws only the strong band, with its own green
 * sparkle; the other bands keep their colours and drop the sparkle rather than wear a green one.
 */
export function ScoreBandPill({ band, style }: ScoreBandPillProps) {
  const { colors, radii, s } = useTheme();
  const sparkle = band === 'strong';

  return (
    <View
      style={[
        styles.pill,
        {
          gap: s(GAP),
          borderRadius: radii.full,
          backgroundColor: colors[BAND_SURFACE[band]],
          paddingLeft: s(sparkle ? PAD_LEFT : PAD_RIGHT),
          paddingRight: s(PAD_RIGHT),
          paddingVertical: s(PAD_Y),
        },
        style,
      ]}
    >
      {sparkle ? <StrongSparkleIcon width={s(SPARKLE.w)} height={s(SPARKLE.h)} /> : null}
      <Text variant="captionSemiBold" color={BAND_TEXT[band]}>
        {`${ATS_BAND_LABEL[band]} match`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center' },
});
