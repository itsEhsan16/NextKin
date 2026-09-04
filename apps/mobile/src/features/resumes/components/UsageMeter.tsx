import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Subscription } from '@/data/models';
import { a11yButton, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type UsageMeterProps = {
  subscription: Subscription;
  onUpgrade: () => void;
  style?: StyleProp<ViewStyle>;
};

const CHEVRON = 9;

/**
 * "2 of 2 free resumes used · Upgrade ›" over the amber usage bar (Figma 1:1388–1:1393).
 * Free plan only — Pro has no cap to meter.
 */
export function UsageMeter({ subscription, onUpgrade, style }: UsageMeterProps) {
  const { colors, spacing, s } = useTheme();
  if (subscription.plan !== 'free') return null;

  const { resumesUsed, resumesLimit } = subscription.usage;
  const label = `${resumesUsed} of ${resumesLimit} free resumes used`;

  return (
    <View style={[{ gap: spacing[2] }, style]}>
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
          style={[styles.upgrade, { gap: spacing[1] + 1 }]}
        >
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
