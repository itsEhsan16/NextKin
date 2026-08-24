import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { formatLakh } from '@/lib';
import { useTheme } from '@/theme';
import { RangeSlider, RangeValueLabel } from '@/ui/RangeSlider';
import { Text } from '@/ui/Text';

import { SALARY_SCALE } from '../filterGroups';

export type SalaryRangeGroupProps = {
  /** Committed bounds, already resolved against the scale ends. */
  value: readonly [number, number];
  onChange: (min: number, max: number) => void;
};

/** The top stop is open-ended: "₹80L+" means no upper bound at all. Runs on the UI thread. */
const formatBound = (value: number): string => {
  'worklet';
  return formatLakh(value, { plus: value >= SALARY_SCALE.max });
};

/**
 * "Salary range" (Figma 1:797–1:804): a heading, a live readout, the dual-thumb slider and the
 * two scale ends. The readout and the thumbs share one pair of shared values, so the number can
 * never disagree with the handles mid-drag.
 */
export function SalaryRangeGroup({ value, onChange }: SalaryRangeGroupProps) {
  const { spacing } = useTheme();
  const low = useSharedValue(value[0]);
  const high = useSharedValue(value[1]);

  const handleChange = useCallback(
    ([min, max]: [number, number]) => onChange(min, max),
    [onChange],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.headingRow}>
        <Text variant="groupLabel" accessibilityRole="header">
          Salary range
        </Text>
        <RangeValueLabel bounds={{ low, high }} value={value} format={formatBound} />
      </View>

      <RangeSlider
        min={SALARY_SCALE.min}
        max={SALARY_SCALE.max}
        step={SALARY_SCALE.step}
        minDistance={SALARY_SCALE.minDistance}
        value={value}
        onChange={handleChange}
        bounds={{ low, high }}
        thumbLabels={['Minimum salary', 'Maximum salary']}
        format={formatBound}
      />

      {/* The thumbs already announce the range, so the static ends are decoration. */}
      <View style={styles.headingRow} importantForAccessibility="no-hide-descendants">
        <Text variant="captionSm" color="textSecondary">
          {formatLakh(SALARY_SCALE.min)}
        </Text>
        <Text variant="captionSm" color="textSecondary">
          {formatLakh(SALARY_SCALE.max, { plus: true })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
