import { Fragment } from 'react';
import { View } from 'react-native';

import type { ZeroCheckRow } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

// ZERO 03 at 390 (613:420 / 613:427), in artboard units.
const COUNT_PAD = 14 / 0.75;
const COUNT_GAP = 8 / 0.75;
const COUNT_RADIUS = 15 / 0.75;
/** The board's empty meter still shows a 2% stub (613:425), so "0 of 9" reads as a meter. */
const MIN_FILL = 0.02;
const COUNT_TO_LIST = 12 / 0.75; // 613:426
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const SLOT_W = 18 / 0.75;
const SLOT_H = 20 / 0.75;
/** The divider starts under the text, past the icon slot (613:434). */
const RULE_INSET = 45 / 0.75;

/**
 * "Checked 0 of 9" and its amber meter, then the four kinds of guess (613:420 / 613:427): a
 * hollow circle while any are left, a green tick once the kind is done. One reading stop a row.
 */
export function ZeroCheckList({
  checked,
  total,
  rows,
}: {
  checked: number;
  total: number;
  rows: readonly ZeroCheckRow[];
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const ratio = total > 0 ? checked / total : 0;

  return (
    <View>
      <Card style={styles.count}>
        <View
          accessible
          accessibilityLabel={`Checked ${checked} of ${total}`}
          style={styles.countRow}
        >
          <Text variant="titleSm" style={styles.grow}>
            Checked
          </Text>
          <Text variant="caption" color="textSecondary">
            {`${checked} of ${total}`}
          </Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ProgressBar
            value={Math.max(MIN_FILL, ratio)}
            fillColor="warningAccent"
            trackColor="surfaceSubtle"
          />
        </View>
      </Card>

      <Card radius="cardLg" padding={0} style={styles.list}>
        {rows.map((row, index) => (
          <Fragment key={row.group}>
            {index > 0 ? (
              <View style={styles.ruleRow}>
                <View style={[styles.rule, { backgroundColor: colors.borderHairline }]} />
              </View>
            ) : null}
            <View accessible accessibilityLabel={`${row.title}, ${row.detail}`} style={styles.row}>
              <View style={styles.slot}>
                {row.done ? (
                  <Icon name="CheckCircle" size="md" color={colors.success} />
                ) : (
                  <Icon name="Circle" size="md" color={colors.iconChevron} />
                )}
              </View>
              <View style={styles.grow}>
                <Text variant="menuRow">{row.title}</Text>
                <Text variant="micro" color="textSecondary" style={styles.detail}>
                  {row.detail}
                </Text>
              </View>
            </View>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  count: { padding: s(COUNT_PAD), gap: s(COUNT_GAP), borderRadius: s(COUNT_RADIUS) },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: s(COUNT_GAP) },
  grow: { flex: 1 },
  list: { marginTop: s(COUNT_TO_LIST) },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  slot: { width: s(SLOT_W), height: s(SLOT_H), alignItems: 'center', justifyContent: 'center' },
  detail: { marginTop: s(LINE_GAP) },
  ruleRow: { paddingLeft: s(RULE_INSET), paddingRight: s(ROW_PAD_X) },
  rule: { height: s(1) },
}));
