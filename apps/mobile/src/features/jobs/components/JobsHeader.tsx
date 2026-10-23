import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { FilterButton } from '@/ui/FilterButton';
import { SearchField } from '@/ui/SearchField';
import { TabTitleRow } from '@/ui/TabTitleRow';

export type JobsHeaderProps = {
  query: string;
  onChangeQuery: (value: string) => void;
  /** Placeholder differs per tab (Figma 1:270 / 1:406 / 1:521). */
  placeholder: string;
  /** Active filter count; the badge only ever appears on Discover. */
  filterCount: number;
  hasUnread: boolean;
  onPressNotifications: () => void;
  onPressFilters: () => void;
};

/** Figma 118:3–118:10 — title + bell, then the search row. Identical across all three tabs. */
export function JobsHeader({
  query,
  onChangeQuery,
  placeholder,
  filterCount,
  hasUnread,
  onPressNotifications,
  onPressFilters,
}: JobsHeaderProps) {
  const { spacing, sizes } = useTheme();

  return (
    <View style={{ gap: sizes.titleRowGap }}>
      <TabTitleRow title="Jobs" hasUnread={hasUnread} onPressNotifications={onPressNotifications} />

      <View style={[styles.searchRow, { gap: spacing[3] }]}>
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          style={styles.search}
        />
        <FilterButton count={filterCount} onPress={onPressFilters} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1 },
});
