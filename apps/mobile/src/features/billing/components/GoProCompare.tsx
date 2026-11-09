import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

/** A cell: a published number, or yes / no. */
type Cell = { kind: 'value'; value: string } | { kind: 'yes' } | { kind: 'no' };

type Row = { icon: LineIconName; title: string; caption: string; free: Cell; pro: Cell };

/**
 * The five lines that decide it (owner's Figma "C · Compare", 2026-11-09, §200), taken from the
 * §13.3 table (`PLAN_FEATURES`): resumes 3 → 100 a month, cover letters 1 → unlimited, interview
 * sets 1 → unlimited per resume, DOCX export and the priority queue Pro only. The full table stays
 * one tap away; this is the at-a-glance answer.
 */
export const GO_PRO_ROWS: readonly Row[] = [
  {
    icon: 'File04',
    title: 'Tailored resumes',
    caption: 'Every month',
    free: { kind: 'value', value: '3' },
    pro: { kind: 'value', value: '100' },
  },
  {
    icon: 'Mail01',
    title: 'Cover letters',
    caption: 'Every month',
    free: { kind: 'value', value: '1' },
    pro: { kind: 'value', value: '∞' },
  },
  {
    icon: 'Mic',
    title: 'Interview prep sets',
    caption: 'Per resume',
    free: { kind: 'value', value: '1' },
    pro: { kind: 'value', value: '∞' },
  },
  {
    icon: 'Download01',
    title: 'DOCX export',
    caption: 'Plus the full template library',
    free: { kind: 'no' },
    pro: { kind: 'yes' },
  },
  {
    icon: 'Rocket01',
    title: 'Priority queue',
    caption: 'Your runs go first',
    free: { kind: 'no' },
    pro: { kind: 'yes' },
  },
];

const spoken = (cell: Cell) =>
  cell.kind === 'yes'
    ? 'included'
    : cell.kind === 'no'
      ? 'not included'
      : cell.value === '∞'
        ? 'unlimited'
        : cell.value;

function CellView({ cell, pro }: { cell: Cell; pro: boolean }) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.cell}>
      {cell.kind === 'value' ? (
        <Text variant="bodyLgStrong" color={pro ? 'brand' : 'textSecondary'}>
          {cell.value}
        </Text>
      ) : cell.kind === 'yes' ? (
        <View style={[styles.tick, { backgroundColor: colors.brand }]}>
          <Icon name="Check" size={u(14)} color={colors.textOnBrand} />
        </View>
      ) : (
        <Icon name="XCircle" size={u(22)} color={colors.iconMuted} />
      )}
    </View>
  );
}

/** Free against Pro on the five lines above, with Pro's column marked. */
export function GoProCompare() {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.head}>
        <Text variant="footnote" color="textTertiary" style={styles.grow}>
          What you get
        </Text>
        <View style={styles.cell}>
          <Text variant="footnote" color="ink">
            Free
          </Text>
        </View>
        <View style={[styles.cell, styles.proHead, { backgroundColor: colors.brandSurface }]}>
          <Text variant="footnote" color="brand">
            Pro
          </Text>
        </View>
      </View>
      {GO_PRO_ROWS.map((row) => (
        <View
          key={row.title}
          accessible
          accessibilityLabel={`${row.title}, ${row.caption}: Free ${spoken(row.free)}, Pro ${spoken(row.pro)}`}
          style={[styles.row, { borderTopColor: colors.borderSoft }]}
        >
          <Icon name={row.icon} size={u(22)} color={colors.ink} />
          <View style={styles.grow}>
            <Text variant="bodyLgStrong" color="ink">
              {row.title}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {row.caption}
            </Text>
          </View>
          <CellView cell={row.free} pro={false} />
          <CellView cell={row.pro} pro />
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: u(8) },
  grow: { flex: 1, gap: u(2) },
  cell: { width: u(58), alignItems: 'center', justifyContent: 'center' },
  proHead: { paddingVertical: u(5), borderRadius: u(999) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(12),
    paddingVertical: u(13),
    borderTopWidth: 1,
  },
  tick: {
    width: u(22),
    height: u(22),
    borderRadius: u(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
