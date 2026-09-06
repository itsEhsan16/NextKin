import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACTIVITY_FILTERS,
  groupByAge,
  matchesActivityFilter,
  NOTIFICATION_GROUP_LABEL,
  type ActivityEntry,
  type AgedFeedItem,
} from '@/data/models';
import { useActivity } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { ActivityRow } from '../components/ActivityRow';
import { useHistoryStore } from '../historyStore';
import { useHistoryActions } from '../hooks/useHistoryActions';

type FeedItem = AgedFeedItem<ActivityEntry>;

const feedKey = (item: FeedItem) => (item.type === 'header' ? `header-${item.group}` : item.row.id);

/** Rows are about 78pt tall; the skeleton holds that height so the list does not jump on load. */
const SKELETON_ROW = 78;

/**
 * HISTORY — the audit trail behind Home's "Activities" tile, as a feed. No artboard covers it
 * (plan §8, phase 9I); the shape is the notifications feed's, which is the designed feed in this
 * app: sticky TODAY / THIS WEEK / EARLIER headers over a FlashList, filter pills above.
 *
 * A pushed screen, so no tab-bar inset — the bottom padding is the safe area alone.
 */
export function HistoryScreen() {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const actions = useHistoryActions();

  const filter = useHistoryStore((state) => state.filter);
  const setFilter = useHistoryStore((state) => state.setFilter);

  const activity = useActivity();
  const list = useMemo(() => activity.data ?? [], [activity.data]);

  const { items, stickyIndices } = useMemo(
    () =>
      groupByAge(
        list.filter((entry) => matchesActivityFilter(entry, filter)),
        (entry) => entry.createdAt,
      ),
    [filter, list],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === 'header') {
        return (
          // An opaque background is load-bearing: a sticky header is transparent otherwise and
          // the rows scroll up through it.
          <View style={[styles.groupHeader, { backgroundColor: colors.surfacePage }]}>
            <Text
              variant="overline"
              color="textSecondary"
              accessibilityRole="header"
              style={{ paddingHorizontal: spacing.gutter }}
            >
              {NOTIFICATION_GROUP_LABEL[item.group]}
            </Text>
            <View style={[styles.pinnedHairline, { backgroundColor: colors.divider }]} />
          </View>
        );
      }
      return <ActivityRow entry={item.row} onOpen={actions.openEntry} />;
    },
    [actions.openEntry, colors, spacing.gutter, styles],
  );

  const status = activity.isPending ? 'pending' : activity.isError ? 'error' : 'success';
  // Two different emptinesses: nothing has ever happened, or the filter emptied a list that has.
  const nothingYet = status === 'success' && list.length === 0;
  const filteredOut = status === 'success' && list.length > 0 && items.length === 0;

  return (
    <Screen
      padded={false}
      edges={['top']}
      header={<ScreenHeader title="History" onBack={actions.goBack} />}
      headerStyle={{ paddingHorizontal: spacing.gutter }}
    >
      {!nothingYet ? (
        <View style={[styles.pills, { paddingHorizontal: spacing.gutter, gap: spacing[2] }]}>
          {ACTIVITY_FILTERS.map((pill) => (
            <FilterChip
              key={pill.key}
              label={pill.label}
              variant="select"
              selected={filter === pill.key}
              onPress={() => setFilter(pill.key)}
            />
          ))}
        </View>
      ) : null}

      {status === 'pending' ? (
        <View style={{ padding: spacing.gutter, gap: spacing[3] }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} height={s(SKELETON_ROW)} radius="card" />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load your history"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void activity.refetch()}
          style={{ marginTop: spacing[10], marginHorizontal: spacing.gutter }}
        />
      ) : nothingYet ? (
        <StateView
          icon="history"
          title="Nothing here yet"
          message="Everything you do — a resume you generate, a job you save, an export — is recorded here."
          actionLabel="Find jobs"
          onAction={actions.findJobs}
          style={{ marginTop: spacing[10], marginHorizontal: spacing.gutter }}
        />
      ) : filteredOut ? (
        <StateView
          icon="filter"
          title="Nothing under this filter"
          message="Your history has entries, just not of this kind."
          actionLabel="Show all"
          onAction={() => setFilter('all')}
          style={{ marginTop: spacing[10], marginHorizontal: spacing.gutter }}
        />
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={feedKey}
          getItemType={(item) => item.type}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={{
            paddingTop: spacing[2],
            paddingBottom: insets.bottom + spacing[8],
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: s(8) },
  groupHeader: { height: s(40), justifyContent: 'center' },
  pinnedHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
}));
