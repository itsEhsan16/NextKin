import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { MatchBand, MatchCriterion, MatchCriterionState } from '@/data/models';
import { a11yButton, hitSlop8, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { MatchPill } from './JobPills';

export type JobMatchCardProps = {
  band: MatchBand;
  criteria: MatchCriterion[];
  onSeeFullCriteria: () => void;
};

const ICON = 15;

/** Each state gets its own glyph and colour, so the row is legible without relying on colour. */
const CRITERION_ICON: Record<MatchCriterionState, { name: string; color: ColorToken; solid: boolean }> =
  {
    met: { name: 'check-circle', color: 'success', solid: true },
    missing: { name: 'times-circle', color: 'danger', solid: true },
    optional: { name: 'circle', color: 'iconMuted', solid: false },
  };

/** Read out instead of the glyph, which a screen reader would otherwise skip entirely. */
const CRITERION_A11Y: Record<MatchCriterionState, string> = {
  met: 'Met',
  missing: 'Missing',
  optional: 'Optional',
};

/**
 * "Why you match" (Figma 1:851). Criteria stagger in on first paint per the motion spec; each row
 * is one accessibility element so the state is announced with its label rather than as a bare icon.
 */
export function JobMatchCard({ band, criteria, onSeeFullCriteria }: JobMatchCardProps) {
  const { colors, spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Card shadow="jobCard" padding={s(19)} style={{ gap: spacing[3] }}>
      <View style={styles.headerRow}>
        <Text variant="title" accessibilityRole="header">
          Why you match
        </Text>
        <MatchPill band={band} />
      </View>
      <Text variant="jobMeta" color="textSecondary">
        Compared against your base resume and profile
      </Text>

      <View style={{ gap: spacing[3] }}>
        {criteria.map((criterion, index) => {
          const icon = CRITERION_ICON[criterion.state];
          const row = (
            <View
              accessible
              accessibilityLabel={`${CRITERION_A11Y[criterion.state]}. ${criterion.label}`}
              style={[styles.criterion, { gap: spacing[3] }]}
            >
              <FontAwesome5
                name={icon.name}
                size={s(ICON)}
                color={colors[icon.color]}
                solid={icon.solid}
              />
              <Text variant="rowLabel" color="textBody" style={styles.criterionLabel}>
                {criterion.label}
              </Text>
            </View>
          );

          return reduced ? (
            <View key={criterion.id}>{row}</View>
          ) : (
            <Animated.View
              key={criterion.id}
              entering={FadeInDown.delay(index * motion.stagger.row).duration(
                motion.durations.base,
              )}
            >
              {row}
            </Animated.View>
          );
        })}
      </View>

      <Pressable
        {...a11yButton('See full criteria', 'Opens the complete match breakdown')}
        feedback="subtle"
        haptic="selection"
        hitSlop={hitSlop8}
        onPress={onSeeFullCriteria}
        style={[styles.link, { gap: spacing[2] - 2 }]}
      >
        <Text variant="captionSemiBold">See full criteria</Text>
        <FontAwesome5 name="chevron-right" size={s(9)} color={colors.textPrimary} solid />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  criterion: { flexDirection: 'row', alignItems: 'flex-start' },
  criterionLabel: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
