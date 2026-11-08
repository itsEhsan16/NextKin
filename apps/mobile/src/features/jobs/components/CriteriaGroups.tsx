import { View } from 'react-native';

import type { MatchCriterion } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import {
  CRITERIA_BAR_COLOR,
  CRITERION_ICON,
  criterionA11yLabel,
  type CriteriaGroup,
} from '../matchCriteria';
import { Icon } from '@/ui/Icon';

// JOBS 10 at 390 (580:2456), in artboard units.
const CARD_GAP = 14 / 0.75;
const HEADING_TO_BAR = 9 / 0.75;
const BAR = 4 / 0.75;
const BAR_TO_ROWS = 7 / 0.75;
const ROW_PAD_Y = 7 / 0.75;
const ROW_GAP = 12 / 0.75;
const ICON_SLOT_W = 18 / 0.75;
/** `prose`'s 22 line — the icon box is that tall so the glyph centres on the FIRST line. */
const ICON_SLOT_H = 22 / 0.75;
const DETAIL_GAP = 2 / 0.75;

type CriterionRowProps = { criterion: MatchCriterion; order: number };

/**
 * One criterion. Not pressable: there is nothing behind it, so it is a single accessibility
 * element that speaks its state rather than a button that leads nowhere.
 */
function CriterionRow({ criterion, order }: CriterionRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const icon = CRITERION_ICON[criterion.state];

  const row = (
    <View accessible accessibilityLabel={criterionA11yLabel(criterion)} style={styles.row}>
      <View style={styles.iconSlot}>
        <Icon name={icon.name} size="md" color={colors[icon.color]} />
      </View>
      <View style={styles.text}>
        <Text variant="prose">{criterion.label}</Text>
        {criterion.detail ? (
          <Text variant="rowDescription" color="textSecondary">
            {criterion.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );

  // No entrance: the criteria are on screen when it opens, not arriving (§191).
  return row;
}

export type CriteriaGroupsProps = { groups: readonly CriteriaGroup[] };

/**
 * The match criteria as one card per group (JOBS 10 580:2456 / 580:2469 / 580:2490): the group's
 * name with its share of every criterion ("1 of 5"), a thin bar of that share in the group's
 * colour, then its rows. The stagger runs across the whole page rather than restarting per
 * group, so the rows read as one list arriving instead of three.
 */
export function CriteriaGroups({ groups }: CriteriaGroupsProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  // Where each group starts in that single run of rows.
  const offsets: number[] = [];
  groups.reduce((start, group) => {
    offsets.push(start);
    return start + group.items.length;
  }, 0);

  return (
    <View style={styles.cards}>
      {groups.map((group, index) => {
        const count = `${group.items.length} of ${total}`;
        return (
          <ProfileCard key={group.state} style={{ padding: spacing[5] }}>
            <View style={styles.heading}>
              <Text {...a11yHeader(group.title)} variant="title" style={styles.text}>
                {group.title}
              </Text>
              <Text variant="micro" color="textSecondary">
                {count}
              </Text>
            </View>
            <ProgressBar
              value={total > 0 ? group.items.length / total : 0}
              height={s(BAR)}
              fillColor={CRITERIA_BAR_COLOR[group.state]}
              accessibilityLabel={`${group.title}, ${count} criteria`}
              style={styles.bar}
            />
            <View style={styles.rows}>
              {group.items.map((criterion, row) => (
                <CriterionRow
                  key={criterion.id}
                  criterion={criterion}
                  order={(offsets[index] ?? 0) + row}
                />
              ))}
            </View>
          </ProfileCard>
        );
      })}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  cards: { gap: s(CARD_GAP) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  bar: { marginTop: s(HEADING_TO_BAR) },
  rows: { marginTop: s(BAR_TO_ROWS) },
  /** Top-aligned, so a criterion with evidence under it keeps its glyph on the label's line. */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(ROW_GAP),
    paddingVertical: s(ROW_PAD_Y),
  },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(DETAIL_GAP) },
}));
