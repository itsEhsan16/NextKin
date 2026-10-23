import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each the height BILLING 01 (577:9155) draws the block it stands in for, at 390
 * in artboard units: the hero's text column, the reason banner, the usage card, the "Choose your
 * plan" row, and the two plan cards — with the board's own gaps between them.
 */
const HERO = 91 / 0.75;
const BANNER = 57.5 / 0.75;
const USAGE = 229 / 0.75;
const SECTION = 36 / 0.75;
const FREE_TILE = 87.5 / 0.75;
const PRO_TILE = 121 / 0.75;
const GAP_SM = 10 / 0.75;
const GAP_MD = 12 / 0.75;
const GAP_LG = 18 / 0.75;

export const LOADING_LABEL = 'Loading plans';

/**
 * The plan screen's loading state: blocks in the shape of the hero, banner, usage meter, period
 * row and the two plan cards, so nothing jumps when the queries land. The screen pins an inert
 * `StickyActionBar` under it because that bar owns the bottom safe-area inset — a loading page
 * without one would resize the viewport the moment the plans arrive.
 */
export function UpgradeSkeleton() {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View accessible accessibilityLabel={LOADING_LABEL}>
      <Skeleton height={s(HERO)} radius="card" />
      <View style={styles.banner}>
        <Skeleton height={s(BANNER)} radius="card" />
      </View>
      <View style={styles.usage}>
        <Skeleton height={s(USAGE)} radius="card" />
      </View>
      <View style={styles.section}>
        <Skeleton height={s(SECTION)} radius="xl" />
      </View>
      <View style={styles.tiles}>
        <Skeleton height={s(FREE_TILE)} radius="card" />
        <Skeleton height={s(PRO_TILE)} radius="card" />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  banner: { marginTop: s(GAP_MD) },
  usage: { marginTop: s(GAP_MD) },
  section: { marginTop: s(GAP_LG) },
  tiles: { marginTop: s(GAP_SM), gap: s(GAP_SM) },
}));
