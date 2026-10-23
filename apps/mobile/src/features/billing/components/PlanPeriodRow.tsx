import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';

import { PLAN_SECTION_TITLE } from '../upgradeCopy';

export type Period = 'monthly' | 'annual';

export const BILLING_PERIOD_LABEL = 'Billing period';

const PERIOD_SEGMENTS: readonly Segment<Period>[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual', label: 'Annual' },
];

// BILLING 01 "Choose your plan" row at 390 (577:9230), in artboard units.
const GAP = 8 / 0.75;
const CONTROL_W = 172 / 0.75;

/** "Choose your plan" with the compact billing-period control at its end (577:9230). */
export function PlanPeriodRow({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text {...a11yHeader(PLAN_SECTION_TITLE)} variant="title" style={styles.title}>
        {PLAN_SECTION_TITLE}
      </Text>
      <View accessibilityLabel={BILLING_PERIOD_LABEL} style={styles.control}>
        <SegmentedControl size="sm" segments={PERIOD_SEGMENTS} value={value} onChange={onChange} />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  title: { flex: 1 },
  control: { width: s(CONTROL_W) },
}));
