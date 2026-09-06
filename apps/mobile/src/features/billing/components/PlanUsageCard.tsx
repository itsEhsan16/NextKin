import { StyleSheet, View } from 'react-native';

import type { SubscriptionPlan, SubscriptionUsage } from '@/data/models';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { publishedCaps, usageMeters, type UsageMeterKey } from '../upgradeCopy';

export type PlanUsageCardProps = {
  usage: SubscriptionUsage;
  /** Decides how the per-document caps read: a Free cap, or Pro's "as often as you like". */
  plan: SubscriptionPlan;
  /** The allowance that sent the reader here; drawn on its own tinted plate. */
  emphasis?: UsageMeterKey;
};

/** Matches the create flow's usage meter (UsageBanner): a 4px bar under the count. */
const BAR_HEIGHT = 4;
const PLATE_PADDING = 12;

/**
 * V2 §13.5's live meter: what this month's allowances have actually gone on, said before any
 * upsell argues for a bigger one. Every row names its published cap ("2 of 3 used"), never a bare
 * percentage, and an allowance the account does not meter is left out rather than drawn at zero.
 */
export function PlanUsageCard({ usage, plan, emphasis }: PlanUsageCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const meters = usageMeters(usage);
  const caps = publishedCaps(usage, plan);

  if (meters.length === 0 && caps.length === 0) return null;

  return (
    <Card radius="card">
      <View style={{ gap: spacing[4] }}>
        {/* The assistant's cap is daily, so the heading cannot say "This month" for every row. */}
        <Text variant="groupLabel">Usage</Text>

        {meters.map((row) => {
          const lit = row.key === emphasis;
          return (
            <View
              key={row.key}
              accessible
              accessibilityLabel={`${row.label}, ${row.line}`}
              style={[
                { gap: spacing[2] },
                lit
                  ? {
                      backgroundColor: colors.brandSurface,
                      borderRadius: radii.md,
                      padding: s(PLATE_PADDING),
                    }
                  : null,
              ]}
            >
              <View style={[styles.row, { gap: spacing[3] }]}>
                <Text variant="caption" style={styles.label} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {`${row.line} ${row.period === 'day' ? 'today' : 'this month'}`}
                </Text>
              </View>
              {/* Hidden from the reader: the line above already says the number, and a
                  progressbar repeating it is a second stop that adds nothing. */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <ProgressBar
                  value={row.fraction}
                  height={s(BAR_HEIGHT)}
                  trackColor={lit ? 'surfaceCard' : 'progressTrack'}
                  fillColor={lit ? 'brand' : 'warningAccent'}
                />
              </View>
            </View>
          );
        })}

        {/* Caps published per document rather than per period: a line, and no bar that would lie. */}
        {caps.map((cap) => (
          <View
            key={cap.key}
            accessible
            accessibilityLabel={`${cap.label}, ${cap.line}`}
            style={[styles.row, { gap: spacing[3] }]}
          >
            <Text variant="caption" style={styles.label} numberOfLines={1}>
              {cap.label}
            </Text>
            <Text variant="caption" color="textSecondary">
              {cap.line}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
