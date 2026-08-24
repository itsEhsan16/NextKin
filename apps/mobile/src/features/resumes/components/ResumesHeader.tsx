import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import type { Subscription } from '@/data/models';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { SearchField } from '@/ui/SearchField';
import { Text } from '@/ui/Text';

import type { ResumesViewMode, ResumeTypeFilter } from '../resumesStore';
import { UsageMeter } from './UsageMeter';
import { ViewModeToggle } from './ViewModeToggle';

export type ResumesHeaderProps = {
  query: string;
  onChangeQuery: (value: string) => void;
  viewMode: ResumesViewMode;
  onChangeViewMode: (mode: ResumesViewMode) => void;
  typeFilter: ResumeTypeFilter;
  onChangeTypeFilter: (filter: ResumeTypeFilter) => void;
  subscription: Subscription | undefined;
  hasUnread: boolean;
  /** First run (RESUMES 05) keeps only the title row — no search, pills or meter. */
  firstRun?: boolean;
  onPressNotifications: () => void;
  onPressSort: () => void;
  onPressUpgrade: () => void;
};

/** All / Resumes / Cover Letters (Figma 1:1378). */
const TYPE_PILLS: readonly { key: ResumeTypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'resume', label: 'Resumes' },
  { key: 'cover_letter', label: 'Cover Letters' },
];

const SORT_CHEVRON = 9;

/** Figma 1:1367–1:1393 — title + bell, search + layout toggle, type pills + sort, usage meter. */
export function ResumesHeader({
  query,
  onChangeQuery,
  viewMode,
  onChangeViewMode,
  typeFilter,
  onChangeTypeFilter,
  subscription,
  hasUnread,
  firstRun = false,
  onPressNotifications,
  onPressSort,
  onPressUpgrade,
}: ResumesHeaderProps) {
  const { colors, spacing, s } = useTheme();

  const titleRow = (
    <View style={styles.titleRow}>
      <Text {...a11yHeader()} variant="screenTitle">
        Resumes
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
  );

  if (firstRun) return titleRow;

  return (
    <View style={{ gap: spacing[4] }}>
      {titleRow}

      <View style={[styles.searchRow, { gap: spacing[3] }]}>
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search resumes and letters"
          accessibilityLabel="Search resumes and letters"
          style={styles.search}
        />
        <ViewModeToggle value={viewMode} onChange={onChangeViewMode} />
      </View>

      <View style={styles.filterRow}>
        <View style={[styles.pills, { gap: spacing[2] }]}>
          {TYPE_PILLS.map((pill) => (
            <FilterChip
              key={pill.key}
              label={pill.label}
              variant="select"
              selected={typeFilter === pill.key}
              onPress={() => onChangeTypeFilter(pill.key)}
            />
          ))}
        </View>
        <Pressable
          {...a11yButton('Sort by Last edited', 'Changes the document order')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(20)}
          onPress={onPressSort}
          style={[styles.sort, { gap: spacing[1] + 2 }]}
        >
          <Text variant="caption" color="textSecondary">
            Last edited
          </Text>
          <FontAwesome5 name="chevron-down" size={s(SORT_CHEVRON)} color={colors.iconMuted} solid />
        </Pressable>
      </View>

      {subscription ? <UsageMeter subscription={subscription} onUpgrade={onPressUpgrade} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flexShrink: 1 },
  sort: { flexDirection: 'row', alignItems: 'center' },
});
