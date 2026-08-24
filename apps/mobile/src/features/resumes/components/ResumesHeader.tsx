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

/**
 * Section spacing is not uniform on the artboard: title 1:1367 ends at 64 and the search
 * field 1:1371 starts at 96; the field ends at 148 and the type pills 1:1378 start at 170;
 * the pills end at 202 and the usage meter 1:1388 starts at 230.
 */
const SEARCH_TOP = 32;
const FILTERS_TOP = 22;
const METER_TOP = 28;

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
    <View>
      {titleRow}

      <View style={[styles.searchRow, { gap: spacing[3], marginTop: s(SEARCH_TOP) }]}>
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search resumes and letters"
          accessibilityLabel="Search resumes and letters"
          style={styles.search}
        />
        <ViewModeToggle value={viewMode} onChange={onChangeViewMode} />
      </View>

      <View style={[styles.filterRow, { marginTop: s(FILTERS_TOP) }]}>
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

      {subscription ? (
        <UsageMeter
          subscription={subscription}
          onUpgrade={onPressUpgrade}
          style={{ marginTop: s(METER_TOP) }}
        />
      ) : null}
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
