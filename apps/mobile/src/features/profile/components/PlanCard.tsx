import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle.svg';
import { SUBSCRIPTION_PLAN_LABEL, type Subscription } from '@/data/models';
import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type PlanCardProps = {
  subscription: Subscription;
  onUpgrade: () => void;
};

const TILE = 44;
const SPARKLE = 20;
const CHEVRON = 10;

/** Figma 1:2229 — "NextKin Free · 2 of 2 resumes · 5 AI credits left · Upgrade ›". */
export function PlanCard({ subscription, onUpgrade }: PlanCardProps) {
  const { colors, radii, spacing } = useTheme();
  const { usage } = subscription;
  const summary = `${usage.resumesUsed} of ${usage.resumesLimit} resumes · ${usage.aiCreditsLeft} AI credits left`;
  const plan = SUBSCRIPTION_PLAN_LABEL[subscription.plan];

  return (
    <Card radius="card" padding={0}>
      <Pressable
        {...a11yButton(`${plan}, ${summary}`, 'Opens the plans page')}
        feedback="subtle"
        haptic="light"
        onPress={onUpgrade}
        style={[styles.row, { padding: spacing[4] - 1, gap: spacing[3] + 2 }]}
      >
        <View
          style={{
            width: TILE,
            height: TILE,
            borderRadius: radii.md,
            backgroundColor: colors.brandSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SparkleIcon width={SPARKLE} height={SPARKLE} color={colors.brand} />
        </View>

        <View style={styles.copy}>
          <Text variant="label" numberOfLines={1}>
            {plan}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {summary}
          </Text>
        </View>

        {subscription.plan === 'free' ? (
          <View style={[styles.upgrade, { gap: spacing[1] + 2 }]}>
            <Text variant="segmentActive">Upgrade</Text>
            <FontAwesome5 name="chevron-right" size={CHEVRON} color={colors.textPrimary} solid />
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: 1 },
  upgrade: { flexDirection: 'row', alignItems: 'center' },
});
