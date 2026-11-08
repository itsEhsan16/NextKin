import { StyleSheet, View } from 'react-native';

import type { ProfileStats } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { AnimatedNumber } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type ProfileStatsCardProps = {
  stats: ProfileStats;
};

const DIVIDER_HEIGHT = 40;
const NO_VALUE = '—';

/** Figma 1:2208 — 12 Applications · 2 Interviews · 87 Avg ATS score, values counting up. */
export function ProfileStatsCard({ stats }: ProfileStatsCardProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();

  const cells = [
    { key: 'applications', value: stats.applications, label: 'Applications' },
    { key: 'interviews', value: stats.interviews, label: 'Interviews' },
    { key: 'ats', value: stats.avgAtsScore, label: 'Avg ATS score' },
  ] as const;

  return (
    <Card radius="card" padding={0} style={styles.card}>
      {cells.map((cell, index) => (
        <View key={cell.key} style={styles.cellWrap}>
          {index > 0 ? (
            <View
              style={{
                width: StyleSheet.hairlineWidth,
                height: s(DIVIDER_HEIGHT),
                backgroundColor: colors.divider,
              }}
            />
          ) : null}
          <View
            accessible
            accessibilityLabel={
              cell.value === undefined
                ? `${cell.label}: not available yet`
                : `${cell.value} ${cell.label.toLowerCase()}`
            }
            style={[styles.cell, { paddingVertical: spacing[4] }]}
          >
            {/* Absent, not zero, when there is nothing to count it from (C-11): a dash, not a 0. */}
            {cell.value === undefined ? (
              <Text variant="statLg" color="textTertiary">
                {NO_VALUE}
              </Text>
            ) : (
              <AnimatedNumber
                value={cell.value}
                memoryKey={`profile:stat:${cell.label}`}
                variant="statLg"
                color="textPrimary"
              />
            )}
            <Text variant="captionSm" color="textSecondary">
              {cell.label}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { flexDirection: 'row', alignItems: 'center' },
  cellWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', gap: s(3) },
}));
