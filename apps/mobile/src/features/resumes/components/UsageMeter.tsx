import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Subscription } from '@/data/models';
import { a11yButton, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import CrownIcon from '../../../../assets/icons/upgrade-crown.svg';

export type UsageMeterProps = {
  subscription: Subscription;
  onUpgrade: () => void;
  style?: StyleProp<ViewStyle>;
};

const CHEVRON = 9;
/** The crown's drawn box, 15.27 × 13 on the 390 board (Figma 529:63), over 0.75. */
const CROWN_W = 15.27 / 0.75;
const CROWN_H = 13 / 0.75;
/** Crown, label and chevron sit 3.75 apart on the 390 board (Figma 529:62). */
const UPGRADE_GAP = 5;

/**
 * "2 of 2 free resumes used · 👑 Upgrade ›" over the amber usage bar (Figma 95:1549–95:1554,
 * 529:62). Free plan only — Pro has no cap to meter.
 */
export function UsageMeter({ subscription, onUpgrade, style }: UsageMeterProps) {
  const { colors, spacing, s } = useTheme();
  if (subscription.plan !== 'free') return null;

  const { resumesUsed, resumesLimit } = subscription.usage;
  const label = `${resumesUsed} of ${resumesLimit} free resumes used`;

  return (
    // The label ends at 211 and the bar starts at 220 on the 390 board: 12 in artboard units.
    <View style={[{ gap: spacing[3] }, style]}>
      <View style={styles.row}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Pressable
          {...a11yButton('Upgrade', 'Opens the plans page')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlop8}
          onPress={onUpgrade}
          style={[styles.upgrade, { gap: s(UPGRADE_GAP) }]}
        >
          <CrownIcon width={s(CROWN_W)} height={s(CROWN_H)} />
          <Text variant="captionSemiBold">Upgrade</Text>
          <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.textPrimary} solid />
        </Pressable>
      </View>
      <ProgressBar
        value={resumesLimit > 0 ? resumesUsed / resumesLimit : 0}
        height={s(4)}
        trackColor="progressTrack"
        fillColor="warningAccent"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upgrade: { flexDirection: 'row', alignItems: 'center' },
});
