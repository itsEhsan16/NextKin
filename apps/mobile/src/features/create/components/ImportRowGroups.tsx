import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import type { ImportGroup, ImportRow } from '../importDraft';

export type ImportRowGroupsProps = {
  groups: readonly ImportGroup[];
  /** Row keys currently switched on. Everything else is rejected. */
  accepted: ReadonlySet<string>;
  onToggle: (key: string, value: boolean) => void;
};

/** The prefs-card row metrics (NOTIF 04), so an accepted row lines up with every other row. */
const ROW_PADDING_X = 19;

type RowProps = {
  row: ImportRow;
  value: boolean;
  divider: boolean;
  onChange: (v: boolean) => void;
};

function AcceptRow({ row, value, divider, onChange }: RowProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            marginHorizontal: s(ROW_PADDING_X),
            backgroundColor: colors.divider,
          }}
        />
      ) : null}
      <View
        style={[
          styles.row,
          { paddingHorizontal: s(ROW_PADDING_X), paddingVertical: spacing[3], gap: spacing[3] },
        ]}
      >
        <View style={styles.text}>
          <Text variant="label" numberOfLines={2}>
            {row.title}
          </Text>
          {row.caption ? (
            <Text variant="rowDescription" color="textSecondary" numberOfLines={2}>
              {row.caption}
            </Text>
          ) : null}
          {/*
            The pill says what the parse could not settle, so an off switch is never a mystery.
            §7.4 / §7.9: an assumption is shown as an assumption, not as a fact already known.
          */}
          {row.warning ? <Chip label={row.warning} style={{ marginTop: spacing[1] }} /> : null}
        </View>
        <Toggle
          value={value}
          onChange={onChange}
          label={row.warning ? `${row.title}, ${row.warning}` : row.title}
        />
      </View>
    </View>
  );
}

/**
 * The parsed rows of an upload, one switch each (V2 §7.4). Nothing here writes anything: the
 * screen above owns the acceptance set and is the only thing that can commit it, because a draft
 * that is half-committed by a scroll is exactly what §7.4 forbids.
 */
export function ImportRowGroups({ groups, accepted, onToggle }: ImportRowGroupsProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();

  let index = 0;

  return (
    <View style={{ gap: spacing[6] }}>
      {groups.map((group) => (
        <View key={group.key} style={{ gap: spacing[3] }}>
          <Text variant="overline" color="textSecondary" accessibilityRole="header">
            {group.title}
          </Text>
          <Card radius="card" padding={0}>
            {group.rows.map((row, rowIndex) => {
              const delay = Math.min(index++, motion.stagger.maxItems) * motion.stagger.row;
              return (
                <Animated.View
                  key={row.key}
                  entering={
                    reduced ? undefined : FadeInDown.delay(delay).duration(motion.durations.base)
                  }
                >
                  <AcceptRow
                    row={row}
                    value={accepted.has(row.key)}
                    divider={rowIndex > 0}
                    onChange={(value) => onToggle(row.key, value)}
                  />
                </Animated.View>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: s(2) },
}));
