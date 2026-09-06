import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { MatchCriterion } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { RowGroup } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { CRITERION_ICON, criterionA11yLabel, type CriteriaGroup } from '../matchCriteria';

/** Grouped-row metrics, matching `ListRow` so the inset dividers land where they do elsewhere. */
const ROW_PADDING = 20;
const ROW_GUTTER = 16;
const ICON = 15;
const ICON_SLOT = 20;
/** `rowLabel`'s leading — the icon box is that tall so the glyph centres on the FIRST line. */
const LABEL_LINE = 21;

type CriterionRowProps = { criterion: MatchCriterion; order: number };

/**
 * One criterion. Not pressable: there is nothing behind it, so it is a single accessibility
 * element that speaks its state rather than a button that leads nowhere.
 */
function CriterionRow({ criterion, order }: CriterionRowProps) {
  const { colors, motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const icon = CRITERION_ICON[criterion.state];

  const row = (
    <View
      accessible
      accessibilityLabel={criterionA11yLabel(criterion)}
      style={[
        styles.row,
        {
          paddingHorizontal: s(ROW_PADDING),
          paddingVertical: spacing[4],
          gap: s(ROW_GUTTER),
        },
      ]}
    >
      <View style={[styles.iconSlot, { width: s(ICON_SLOT), height: s(LABEL_LINE) }]}>
        <FontAwesome5
          name={icon.name}
          size={s(ICON)}
          color={colors[icon.color]}
          solid={icon.solid}
        />
      </View>
      <View style={[styles.text, { gap: s(2) }]}>
        <Text variant="rowLabel" color="textBody">
          {criterion.label}
        </Text>
        {criterion.detail ? (
          <Text variant="rowDescription" color="textSecondary">
            {criterion.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (reduced) return row;

  return (
    <Animated.View
      entering={FadeInDown.delay(
        Math.min(order, motion.stagger.maxItems) * motion.stagger.row,
      ).duration(motion.durations.base)}
    >
      {row}
    </Animated.View>
  );
}

export type CriteriaGroupsProps = { groups: readonly CriteriaGroup[] };

/**
 * The match criteria as carded groups (V2 §7.13). The stagger runs across the whole page rather
 * than restarting per group, so the rows read as one list arriving instead of three.
 */
export function CriteriaGroups({ groups }: CriteriaGroupsProps) {
  const { spacing } = useTheme();

  // Where each group starts in that single run of rows.
  const offsets: number[] = [];
  groups.reduce((total, group) => {
    offsets.push(total);
    return total + group.items.length;
  }, 0);

  return (
    <View style={{ gap: spacing[5] }}>
      {groups.map((group, index) => (
        <RowGroup key={group.state} title={group.title}>
          {group.items.map((criterion, row) => (
            <CriterionRow
              key={criterion.id}
              criterion={criterion}
              order={(offsets[index] ?? 0) + row}
            />
          ))}
        </RowGroup>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Top-aligned, so a criterion with evidence under it keeps its glyph on the label's line. */
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconSlot: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
