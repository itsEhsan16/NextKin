import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SALARY_FILTER_MAX, SALARY_FILTER_MIN, SALARY_FILTER_STEP } from '@/data/models';
import { EMPLOYMENT_TYPE_OPTIONS, EXPERIENCE_OPTIONS } from '@/features/jobs/filterGroups';
import { formatLakh, formatSalaryBand } from '@/lib';
import { useTheme } from '@/theme';
import { FilterChip, Screen, Text } from '@/ui';
import { RangeSlider } from '@/ui/RangeSlider';
import { DevSection } from '@/ui/dev';

const format = (value: number) => formatLakh(value, { plus: value >= SALARY_FILTER_MAX });

/** Gallery page for the primitives JOBS 04 introduced. */
export default function DevFiltersRoute() {
  const { spacing } = useTheme();
  const [types, setTypes] = useState<string[]>(['full_time']);
  const [level, setLevel] = useState<string | undefined>(undefined);
  const [salary, setSalary] = useState<[number, number]>([2_000_000, 4_500_000]);

  return (
    <Screen scroll edges={[]}>
      <DevSection
        title="Filter chips"
        description="The `filter` variant: boxed like `select`, checked like `toggle`, set in 14pt."
      >
        <View style={[styles.row, { gap: spacing[2] }]}>
          {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              variant="filter"
              label={option.label}
              selected={types.includes(option.value)}
              onPress={() =>
                setTypes((current) =>
                  current.includes(option.value)
                    ? current.filter((type) => type !== option.value)
                    : [...current, option.value],
                )
              }
            />
          ))}
        </View>
        <View style={[styles.row, { gap: spacing[2] }]}>
          {EXPERIENCE_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              variant="filter"
              label={option.label}
              selected={level === option.value}
              onPress={() => setLevel(option.value)}
            />
          ))}
        </View>
      </DevSection>

      <DevSection
        title="Range slider"
        description="Both thumbs run on the UI thread; JS hears about it once, on release."
      >
        <Text variant="bodySemiBold">
          {formatSalaryBand(
            salary[0] > SALARY_FILTER_MIN ? salary[0] : undefined,
            salary[1] < SALARY_FILTER_MAX ? salary[1] : undefined,
            SALARY_FILTER_MAX,
          )}
        </Text>
        <RangeSlider
          min={SALARY_FILTER_MIN}
          max={SALARY_FILTER_MAX}
          step={SALARY_FILTER_STEP}
          minDistance={500_000}
          value={salary}
          onChange={setSalary}
          thumbLabels={['Minimum salary', 'Maximum salary']}
          format={format}
        />
        <View style={styles.scale}>
          <Text variant="captionSm" color="textSecondary">
            {formatLakh(SALARY_FILTER_MIN)}
          </Text>
          <Text variant="captionSm" color="textSecondary">
            {formatLakh(SALARY_FILTER_MAX, { plus: true })}
          </Text>
        </View>
      </DevSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
});
