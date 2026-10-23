import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { REASON_LINE } from '../upgradeCopy';
import type { UpgradeReason } from '../upgradeReasons';

export type PlanReasonBannerProps = { reason: UpgradeReason };

// BILLING 01 reason banner at 390 (577:9177), in artboard units.
const RADIUS = 15 / 0.75;
const BORDER = 0.75 / 0.75;
const PAD_LEFT = 10 / 0.75;
const PAD_RIGHT = 14 / 0.75;
const PAD_Y = 10 / 0.75;
const GAP = 10 / 0.75;
const TILE = 30 / 0.75;
const TILE_RADIUS = 9 / 0.75;
const GLYPH = 12 / 0.75;

/**
 * V2 §13.5 — the screen opens on the limit that was actually reached rather than on a pitch,
 * drawn as the amber panel with a white lock tile (577:9177). A reader who arrived with no reason
 * (the plan row on Profile, say) gets no banner at all: an invented generic line would be a claim
 * nobody made.
 */
export function PlanReasonBanner({ reason }: PlanReasonBannerProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.tile, { backgroundColor: colors.surfaceCard }]}
      >
        <FontAwesome5 name="lock" size={s(GLYPH)} color={colors.warningStrong} solid />
      </View>
      <Text variant="bodyMedium" style={styles.line}>
        {REASON_LINE[reason]}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(GAP),
    borderRadius: s(RADIUS),
    borderWidth: s(BORDER),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1 },
}));
