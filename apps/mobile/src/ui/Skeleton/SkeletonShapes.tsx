import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

import { Skeleton, type SkeletonProps } from './Skeleton';

/**
 * Silhouettes (§196): a section's placeholder traces its loaded layout with a few large shapes —
 * a card, a thumbnail, a circle, two or three short bars — never one bar per word. The shimmer
 * runs in screen space, so a silhouette made of several shapes still lights up as one surface.
 * Keep each silhouette's outer size equal to the loaded section's, so nothing moves on arrival.
 */

/** One section's or card's placeholder: a single shape with the card radius. */
export function SkeletonBlock({
  height,
  width = '100%',
  tone,
  style,
}: {
  height: number;
  width?: DimensionValue;
  tone?: SkeletonProps['tone'];
  style?: StyleProp<ViewStyle>;
}) {
  const { u } = useTheme();
  return (
    <Skeleton width={width} height={height} tone={tone} style={[{ borderRadius: u(24) }, style]} />
  );
}

/** A row of shapes side by side (a carousel's cards, a stat strip). */
export function SkeletonRow({ children, gap }: { children: ReactNode; gap: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

/** An avatar, a score ring, a round icon. */
export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={size} height={size} radius="full" style={style} />;
}

/**
 * A title and its supporting lines: short rounded bars at the given widths. The first bar is the
 * title (taller); the rest are meta lines. Two or three bars, never a paragraph of them.
 */
export function SkeletonLines({
  widths,
  title,
  line,
  gap,
  style,
}: {
  /** One width per bar, e.g. `['70%', '45%']`. */
  widths: readonly DimensionValue[];
  /** The first bar's height. Defaults to a title line. */
  title?: number;
  /** Every other bar's height. Defaults to a meta line. */
  line?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { s, spacing } = useTheme();
  return (
    <View style={[{ gap: gap ?? spacing[2] }, style]}>
      {widths.map((w, i) => (
        <Skeleton
          key={i}
          width={w}
          height={i === 0 ? (title ?? s(16)) : (line ?? s(12))}
          radius="full"
        />
      ))}
    </View>
  );
}

/**
 * A list row's silhouette: a thumbnail (square or round), a title and one or two meta bars, and
 * an optional short bar on the right (a time, a score), with an optional hairline under it.
 * `height` is the loaded row's height, so the list keeps its length when content lands.
 */
export function SkeletonListRow({
  height,
  thumb,
  round = false,
  lines = 2,
  trailing = false,
  divider = false,
  style,
}: {
  height: number;
  /** The thumbnail's size; 0 for a row with no thumbnail. */
  thumb: number;
  round?: boolean;
  lines?: 1 | 2 | 3;
  trailing?: boolean;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, s } = useTheme();
  const widths: DimensionValue[] = ['72%', '48%', '60%'].slice(0, lines) as DimensionValue[];
  return (
    <View
      style={[
        styles.listRow,
        { height, gap: spacing[3] },
        divider
          ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft }
          : null,
        style,
      ]}
    >
      {thumb > 0 ? <Skeleton width={thumb} height={thumb} radius={round ? 'full' : 'md'} /> : null}
      <SkeletonLines widths={widths} style={styles.grow} />
      {trailing ? (
        <Skeleton width={s(48)} height={s(12)} radius="full" style={styles.trailing} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  trailing: { alignSelf: 'flex-start', marginTop: '6%' },
});
