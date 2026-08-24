import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { FilterButton } from '@/ui/FilterButton';
import { IconButton } from '@/ui/IconButton';
import { SearchField } from '@/ui/SearchField';
import { Text } from '@/ui/Text';

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

/** Figma 1:264–1:274 — title + bell, then the search row. Identical across all three tabs. */
export function JobsHeader({
  query,
  onChangeQuery,
  placeholder,
  filterCount,
  hasUnread,
  onPressNotifications,
  onPressFilters,
}: JobsHeaderProps) {
  const { spacing, s } = useTheme();

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.titleRow}>
        <Text {...a11yHeader()} variant="screenTitle">
          Jobs
        </Text>
        <IconButton
          icon="bell"
          iconStyle="regular"
          iconSize={s(18)}
          label={hasUnread ? 'Notifications, unread' : 'Notifications'}
          dot={hasUnread}
          onPress={onPressNotifications}
        />
      </View>

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1 },
});
