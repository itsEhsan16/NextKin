import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  matchBasisCaption,
  type MatchBand,
  type MatchBasis,
  type MatchCriterion,
  type MatchCriterionState,
} from '@/data/models';
import { a11yButton, hitSlop8, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { MatchPill } from './JobPills';
import { Icon, type LineIconName } from '@/ui/Icon';

export type JobMatchCardProps = {
  band: MatchBand;
  criteria: MatchCriterion[];
  /** What the band rests on (G16); spec-derived until an artboard draws it (toreview §105.18). */
  basis?: MatchBasis;
  onSeeFullCriteria: () => void;
};

// The drawing beside the criteria (Figma 443:120) was removed at the owner's request (§182).

/** Each state gets its own glyph and colour, so the row is legible without relying on colour. */
const CRITERION_ICON: Record<MatchCriterionState, { name: LineIconName; color: ColorToken }> = {
  met: { name: 'CheckCircle', color: 'success' },
  partial: { name: 'CheckCircle', color: 'success' },
  missing: { name: 'XCircle', color: 'danger' },
  optional: { name: 'Circle', color: 'iconMuted' },
};

/** Read out instead of the glyph, which a screen reader would otherwise skip entirely. */
const CRITERION_A11Y: Record<MatchCriterionState, string> = {
  met: 'Met',
  partial: 'Partly met',
  missing: 'Missing',
  optional: 'Optional',
};

/**
 * "Why you match" (Figma 1:851, redrawn as 443:23 with the illustration and a glyph on the pill). Criteria stagger in on first paint per the motion spec; each row
 * is one accessibility element so the state is announced with its label rather than as a bare icon.
 */
export function JobMatchCard({ band, criteria, basis, onSeeFullCriteria }: JobMatchCardProps) {
  const { colors, spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Card padding={s(19)} style={{ gap: spacing[3] }}>
      <View style={styles.headerRow}>
        <Text variant="title3" color="ink" accessibilityRole="header">
          Why you match
        </Text>
        <MatchPill band={band} icon="BarChart07" />
      </View>
      <Text variant="jobMeta" color="textSecondary">
        Compared against your base resume and profile
      </Text>
      {basis ? (
        <Text variant="microRegular" color="textSecondary">
          {matchBasisCaption(basis)}
        </Text>
      ) : null}

      <View style={{ gap: spacing[3] }}>
        {criteria.map((criterion, index) => {
          const icon = CRITERION_ICON[criterion.state];
          const row = (
            <View
              accessible
              accessibilityLabel={`${CRITERION_A11Y[criterion.state]}. ${criterion.label}`}
              style={[styles.criterion, { gap: spacing[3] }]}
            >
              <Icon name={icon.name} size="sm" color={colors[icon.color]} />
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
        <Icon name="ChevronRight" size="xs" color={colors.textPrimary} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  criterion: { flexDirection: 'row', alignItems: 'flex-start' },
  criterionLabel: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  art: { position: 'absolute', top: 0 },
});
