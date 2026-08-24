import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import type { Profile } from '@/data/models';
import { a11yButton, formatPercent, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type CompletenessCardProps = {
  profile: Profile;
  onCompleteStep: (id: string) => void;
};

const PLUS = 9;

/**
 * Figma 1:2217 — "Profile 72% complete" with the ink meter and the next-step chips.
 * Completing a chip exits it (fade + the row re-flowing) while the bar — and the identity
 * ring above, which reads the same completeness — animates up.
 */
export function CompletenessCard({ profile, onCompleteStep }: CompletenessCardProps) {
  const { colors, motion, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  return (
    <Card radius="card" padding={19} style={{ gap: spacing[3] }}>
      <Text variant="label" accessibilityRole="header">
        {`Profile ${formatPercent(profile.completeness)} complete`}
      </Text>

      <ProgressBar
        value={profile.completeness}
        trackColor="surfaceSubtle"
        fillColor="surfaceInverse"
        accessibilityLabel="Profile completeness"
      />

      <Text variant="caption" color="textSecondary">
        Complete profiles get better matches and faster tailoring.
      </Text>

      {profile.nextSteps.length > 0 ? (
        <Animated.View
          layout={reduced ? undefined : LinearTransition.springify()}
          style={[styles.chips, { gap: spacing[2], marginTop: spacing[1] }]}
        >
          {profile.nextSteps.map((step) => (
            <Animated.View
              key={step.id}
              exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
              layout={reduced ? undefined : LinearTransition.springify()}
            >
              <Pressable
                {...a11yButton(step.label, 'Marks this step as done')}
                feedback="scale"
                haptic="light"
                onPress={() => onCompleteStep(step.id)}
                style={[
                  styles.chip,
                  {
                    gap: spacing[1] + 2,
                    borderRadius: radii.full,
                    borderColor: colors.borderDefault,
                    backgroundColor: colors.surfaceCard,
                  },
                ]}
              >
                <FontAwesome5 name="plus" size={s(PLUS)} color={colors.textPrimary} solid />
                <Text variant="captionSemiBold">{step.label}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: s(1),
    paddingHorizontal: s(14),
    paddingVertical: s(7),
  },
}));
