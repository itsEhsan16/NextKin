import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Plan } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import {
  goProOfferLine,
  goProSaveBadge,
  GO_PRO_CTA,
  GO_PRO_EYEBROW,
  GO_PRO_LEDE,
  GO_PRO_OFFER_TITLE,
  GO_PRO_STAY_FREE,
  GO_PRO_TITLE,
  type AnnualSaving,
} from '../upgradeCopy';
import type { Period } from './PlanPeriodRow';
import { GoProCompare } from './GoProCompare';
import { PeriodSwitch } from './PeriodSwitch';

export type GoProOfferProps = {
  period: Period;
  onPeriod: (period: Period) => void;
  /** The SKU for the period picked. */
  plan: Plan;
  saving?: AnnualSaving;
  /** Why the reader is here (§13.5), said once under the lede. */
  reasonLine?: string;
  onStart: () => void;
  onClose: () => void;
};

/** The backdrop: lavender at the top, white through the middle, deeper violet at the foot. */
function Backdrop() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="goProWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brandSurface} />
            <Stop offset="0.55" stopColor={colors.surfacePage} />
            <Stop offset="1" stopColor="#C9C2FF" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#goProWash)" />
      </Svg>
    </View>
  );
}

/**
 * The plan screen for a Free account (owner's Figma "C · Compare", node 442:442, 2026-11-09,
 * §200): one promise, a Monthly / Yearly switch, Free against Pro on five lines, then the offer
 * and one button. It replaces the screen that stacked a hero, the reason banner, the usage meters,
 * plan tiles, the full feature table and two notes. Nothing is charged here: Start Pro opens the
 * checkout confirm, as before.
 */
export function GoProOffer({
  period,
  onPeriod,
  plan,
  saving,
  reasonLine,
  onStart,
  onClose,
}: GoProOfferProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const yearly = period === 'annual';

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + u(8) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.closeRow}>
          <IconButton icon="XClose" label="Close" onPress={onClose} />
        </View>

        <View style={styles.hero}>
          <Text variant="eyebrow" color="brand" align="center">
            {GO_PRO_EYEBROW}
          </Text>
          <Text variant="largeTitle" color="ink" align="center" accessibilityRole="header">
            {GO_PRO_TITLE}
          </Text>
          <Text variant="bodyLg" color="textSecondary" align="center" style={styles.lede}>
            {GO_PRO_LEDE}
          </Text>
          {reasonLine ? (
            <View style={[styles.reason, { backgroundColor: colors.surfaceCard }]}>
              <Icon name="InfoCircle" size="sm" color={colors.brand} />
              <Text variant="footnote" color="ink" style={styles.reasonText}>
                {reasonLine}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.switchRow}>
          <PeriodSwitch
            value={period}
            onChange={onPeriod}
            yearlyBadge={saving ? `−${saving.percent}%` : undefined}
          />
        </View>

        <View style={styles.table}>
          <GoProCompare />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + u(16) }]}>
        <View style={styles.offer}>
          <View style={styles.offerText}>
            <Text variant="title3" color="ink">
              {GO_PRO_OFFER_TITLE}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {goProOfferLine(plan)}
            </Text>
          </View>
          {yearly && saving ? (
            <View style={[styles.save, { backgroundColor: colors.successSurface }]}>
              <Text variant="footnote" color="success">
                {goProSaveBadge(saving)}
              </Text>
            </View>
          ) : null}
        </View>
        <Button label={GO_PRO_CTA} size="xl" block onPress={onStart} />
        <Pressable
          {...a11yButton(GO_PRO_STAY_FREE)}
          feedback="subtle"
          onPress={onClose}
          style={styles.stayFree}
        >
          <Text variant="bodySemiBold" color="ink">
            {GO_PRO_STAY_FREE}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  content: { paddingHorizontal: u(24), paddingBottom: u(24) },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', gap: u(8), marginTop: u(4) },
  lede: { maxWidth: u(320) },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(8),
    marginTop: u(6),
    paddingHorizontal: u(12),
    paddingVertical: u(8),
    borderRadius: u(14),
  },
  reasonText: { flexShrink: 1 },
  switchRow: { marginTop: u(18) },
  table: { marginTop: u(22) },
  footer: { paddingHorizontal: u(20), paddingTop: u(10), gap: u(12) },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(10),
    paddingVertical: u(14),
    paddingLeft: u(18),
    paddingRight: u(14),
    borderRadius: u(22),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  offerText: { flex: 1, gap: u(2) },
  save: { paddingHorizontal: u(10), paddingVertical: u(5), borderRadius: u(999) },
  stayFree: { alignSelf: 'center', paddingVertical: u(4) },
}));
