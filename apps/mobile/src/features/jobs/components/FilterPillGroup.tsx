import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

import type { FilterOption } from '../filterGroups';

export type FilterPillGroupProps<T> = {
  title: string;
  options: readonly FilterOption<T>[];
  isSelected: (value: T) => boolean;
  onToggle: (value: T) => void;
};

/**
 * One labelled row of filter pills in the Filters sheet (Figma 1:766 / 1:777 / 1:788 / 1:805).
 *
 * The row wraps rather than scrolling horizontally: "Experience level" ships five pills, which
 * overflow a phone width, and an off-screen option a screen reader can reach but a sighted user
 * cannot see is worse than a second line. This also matches the chip rows on JOBS 01.
 */
export function FilterPillGroup<T>({
  title,
  options,
  isSelected,
  onToggle,
}: FilterPillGroupProps<T>) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[2] }}>
      <Text variant="groupLabel" accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.row, { gap: spacing[2] }]}>
        {options.map((option) => (
          <FilterChip
            key={option.id}
            variant="filter"
            label={option.label}
            selected={isSelected(option.value)}
            onPress={() => onToggle(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
