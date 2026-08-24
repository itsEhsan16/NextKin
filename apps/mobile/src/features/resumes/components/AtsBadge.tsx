import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';

import { atsScoreColor } from '../docMeta';

export type AtsBadgeProps = {
  score: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const BADGE = 44;
const RING = 36;
const STROKE = 3.5;

/**
 * The floating 44pt ATS chip on every document card (Figma 1:1415): a white circle with its
 * own shadow, a colour-banded mini ring and the score in 13pt bold. Tapping it opens the
 * score panel (RESUMES 04).
 */
export function AtsBadge({ score, onPress, style }: AtsBadgeProps) {
  const { colors, radii, shadows, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`ATS score ${score}`, 'Opens the score breakdown')}
      feedback="scale"
      haptic="light"
      hitSlop={hitSlopFor(BADGE)}
      onPress={onPress}
      disabled={!onPress}
      style={[
        {
          width: s(BADGE),
          height: s(BADGE),
          borderRadius: radii.full,
          backgroundColor: colors.surfaceCard,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadows.segmentPill,
        style,
      ]}
    >
      {/* The ring is decorative here: the pressable's own label already reads the score, and a
          second focusable meter inside a 44pt button would double-announce it. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ScoreRing
          score={score}
          size={s(RING)}
          strokeWidth={s(STROKE)}
          ringColor={atsScoreColor(score)}
          trackColor="surfaceSubtle"
          numberVariant="scoreSm"
          numberColor="textPrimary"
        />
      </View>
    </Pressable>
  );
}
