import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  const { artboardShadows, colors, radii, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`ATS score ${score}`, 'Opens the score breakdown')}
      feedback="scale"
      haptic="light"
      hitSlop={hitSlopFor(s(BADGE))}
      onPress={onPress}
      disabled={!onPress}
      style={[
        {
          width: s(BADGE),
          height: s(BADGE),
          borderRadius: radii.full,
          backgroundColor: colors.surfaceCard,
          // A hairline the artboard does not draw, and the one deliberate departure on this
          // component. Figma gives the disc its edge with a shadow; Android cannot reproduce that
          // shadow at this size, and the disc is surfaceCard on a surfaceCard thumbnail, so
          // without an edge it is invisible. That would be survivable on its own — but the
          // thumbnail's own s(1) border passes within 4 physical pixels of the disc's right edge
          // and runs underneath its bottom, so the eye attaches that grey line to the disc and
          // reads it as a cut. One hairline closes the circle and the line stops belonging to it.
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderDefault,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Not `shadows.segmentPill`: on Android that resolves to a bare `{ elevation: 2 }` and the
        // artboard's 0 1 3 8% blur never renders. This disc is surfaceCard on a surfaceCard
        // thumbnail, so that shadow carries what edge it can — see `artboardShadows` on the theme.
        // Nothing here needs elevation for z: the badge is already the thumbnail's later sibling.
        artboardShadows.segmentPill,
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
