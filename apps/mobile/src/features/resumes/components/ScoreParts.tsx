import { Fragment } from 'react';
import { View } from 'react-native';

import type { AtsComponent } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type ScorePartsProps = { parts: readonly AtsComponent[] };

// In the TAILOR 02 card's measures ("What to improve" 607:100), in artboard units.
const PAD_X = 15 / 0.75;
const PAD_Y = 12 / 0.75;
const RULE = 1 / 0.75;

const points = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * "Where your points go" (toreview §146.1): the rubric's five parts, each with what it earns of its
 * weight and what that rests on, in the engine's own words. A part that wasn't measured says so
 * rather than showing a zero. Spec-derived (V2 §7.8) from TAILOR 02's card and the app's meter.
 */
export function ScoreParts({ parts }: ScorePartsProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ gap: spacing[3] }}>
      <Text {...a11yHeader()} variant="title">
        Where your points go
      </Text>
      <ProfileCard>
        {parts.map((part, index) => {
          const earned =
            part.points === null ? 'Not measured' : `${points(part.points)} of ${part.weight}`;
          return (
            <Fragment key={part.key}>
              {index > 0 ? (
                <View style={[styles.rule, { backgroundColor: colors.divider }]} />
              ) : null}
              <View
                accessible
                accessibilityLabel={`${part.label}: ${earned}. ${part.basis}`}
                style={[styles.row, { gap: spacing[1] }]}
              >
                <View style={styles.head}>
                  <Text variant="menuRow">{part.label}</Text>
                  <Text variant="captionSemiBold" color="textSecondary">
                    {earned}
                  </Text>
                </View>
                <ProgressBar value={(part.points ?? 0) / part.weight} />
                <Text variant="micro" color="textSecondary">
                  {part.basis}
                </Text>
              </View>
            </Fragment>
          );
        })}
      </ProfileCard>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { paddingHorizontal: s(PAD_X), paddingVertical: s(PAD_Y) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rule: { height: s(RULE), marginHorizontal: s(PAD_X) },
}));
