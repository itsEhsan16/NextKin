import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HistoryArt from '../../../../assets/icons/history/hero-history.svg';
import {
  ACTIVITY_FILTERS,
  GENERATION_ACTIVITY_KIND,
  groupByAge,
  matchesActivityFilter,
  unfinishedRuns,
  type ActivityEntry,
  type AgedFeedItem,
  type Generation,
  type NotificationGroup,
} from '@/data/models';
import { queryPhase, useActivity, useGenerations } from '@/data/queries';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { ActivityRow } from '../components/ActivityRow';
import { RunRow } from '../components/RunRow';
import { useHistoryStore } from '../historyStore';
import { useHistoryActions } from '../hooks/useHistoryActions';

type FeedItem =
  AgedFeedItem<ActivityEntry> | { type: 'unfinished' } | { type: 'run'; run: Generation };

const feedKey = (item: FeedItem) => {
  if (item.type === 'header') return `header-${item.group}`;
  if (item.type === 'unfinished') return item.type;
  return item.type === 'run' ? `run-${item.run.id}` : item.row.id;
};

/** Cards are about 90pt tall at 390; the skeleton holds that so the list does not jump on load. */
const SKELETON_ROW = 90 / 0.75;

// HISTORY 01 at 390 (580:2928), in artboard units.
const HEADER_TO_HERO = 6 / 0.75;
const HERO_ART_W = 64 / 0.75;
const HERO_ART_H = 64.9215 / 0.75;
const ART_TO_TITLE = 12 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;
const HERO_TO_CHIPS = 18 / 0.75;
const CHIP_GAP = 7 / 0.75;
/** Chips → first heading, and the last card of a group → the next heading (580:2959). */
const SECTION_TOP = 24 / 0.75;
const HEADING_TO_CARDS = 12 / 0.75;
const CARD_GAP = 10 / 0.75;

/** The board names its groups in sentence case (580:2961 / 580:3090). */
const GROUP_TITLE: Record<NotificationGroup, string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

/** Heads the runs still working or stopped by a failure (V2 §7.2, toreview §145.3). */
const UNFINISHED_TITLE = 'Not finished';

/**
 * HISTORY — the audit trail behind Home's "Activities" tile, drawn as HISTORY 01 (580:2928): a
 * hero, the filter chips, then one card per entry under Today / This week / Earlier. Runs that
 * haven't finished sit above those groups: this is their home, and the bell reports when they end.
 *
 * A pushed screen, so no tab-bar inset — the bottom padding is the safe area alone.
 */
export function HistoryScreen() {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const actions = useHistoryActions();

  const filter = useHistoryStore((state) => state.filter);
  const setFilter = useHistoryStore((state) => state.setFilter);

  const activity = useActivity();
  const list = useMemo(() => activity.data ?? [], [activity.data]);

  const runs = useGenerations();
  const unfinished = useMemo(() => unfinishedRuns(runs.data ?? []), [runs.data]);

  const { items } = useMemo(
    () =>
      groupByAge(
        list.filter((entry) => matchesActivityFilter(entry, filter)),
        (entry) => entry.createdAt,
      ),
    [filter, list],
  );

  const feed = useMemo<FeedItem[]>(() => {
    const shown = unfinished.filter((run) =>
      matchesActivityFilter({ kind: GENERATION_ACTIVITY_KIND[run.kind] }, filter),
    );
    return [
      ...(shown.length > 0 ? [{ type: 'unfinished' as const }] : []),
      ...shown.map((run) => ({ type: 'run' as const, run })),
      ...items,
    ];
  }, [filter, items, unfinished]);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
      if (item.type === 'header' || item.type === 'unfinished') {
        return (
          <Text
            {...a11yHeader()}
            variant="title"
            style={[
              styles.heading,
              {
                paddingHorizontal: spacing.gutter,
                marginTop: index === 0 ? 0 : s(SECTION_TOP - CARD_GAP),
              },
            ]}
          >
            {item.type === 'header' ? GROUP_TITLE[item.group] : UNFINISHED_TITLE}
          </Text>
        );
      }
      return (
        <View style={[styles.cardSlot, { paddingHorizontal: spacing.gutter }]}>
          {item.type === 'run' ? (
            <RunRow run={item.run} onOpen={actions.openEntry} />
          ) : (
            <ActivityRow entry={item.row} onOpen={actions.openEntry} />
          )}
        </View>
      );
    },
    [actions.openEntry, s, spacing.gutter, styles],
  );

  const phase = queryPhase(activity);
  // The feed waits for the runs, so their group doesn't push it down a moment after it lands. A
  // failed read of the runs ends that wait: the feed still has plenty to show.
  const status = phase === 'success' && runs.isPending ? 'pending' : phase;
  // Two different emptinesses: nothing has ever happened, or the filter emptied a list that has.
  // A first run hasn't reached the feed, which records what finished, so it counts as something.
  const nothingYet = status === 'success' && list.length === 0 && unfinished.length === 0;
  const filteredOut = status === 'success' && !nothingYet && feed.length === 0;

  const hero = (
    <View style={[styles.top, { paddingHorizontal: spacing.gutter }]}>
      <View style={styles.hero}>
        <HistoryArt width={s(HERO_ART_W)} height={s(HERO_ART_H)} />
        <Text {...a11yHeader()} variant="headlineLg" align="center" style={styles.title}>
          History
        </Text>
        <Text variant="captionRegular" color="textSecondary" align="center" style={styles.lede}>
          Everything you&apos;ve generated, saved and changed
        </Text>
      </View>
      {!nothingYet ? (
        <View style={styles.pills}>
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
    </View>
  );

  return (
    <Screen
      padded={false}
      edges={['top']}
      header={<ScreenHeader title="History" showTitle={false} onBack={actions.goBack} />}
      headerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: s(HEADER_TO_HERO) }}
    >
      {status !== 'success' || nothingYet || filteredOut ? hero : null}

      {status === 'pending' ? (
        <View style={{ padding: spacing.gutter, gap: spacing[3] }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} height={s(SKELETON_ROW)} radius="card" />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn't load your history"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void activity.refetch()}
          style={{ marginHorizontal: spacing.gutter }}
        />
      ) : nothingYet ? (
        <StateView
          art="noHistory"
          icon="ClockRewind"
          title="Nothing here yet"
          message="Resumes, saved jobs and exports are recorded here."
          actionLabel="Find jobs"
          onAction={actions.findJobs}
          style={{ marginHorizontal: spacing.gutter }}
        />
      ) : filteredOut ? (
        <StateView
          art="noHistory"
          icon="FilterLines"
          title="Nothing under this filter"
          actionLabel="Show all"
          onAction={() => setFilter('all')}
          style={{ marginHorizontal: spacing.gutter }}
        />
      ) : (
        <FlashList
          data={feed}
          renderItem={renderItem}
          keyExtractor={feedKey}
          getItemType={(item) => item.type}
          ListHeaderComponent={hero}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  top: { paddingBottom: s(SECTION_TOP) },
  hero: { alignItems: 'center' },
  title: { marginTop: s(ART_TO_TITLE) },
  lede: { marginTop: s(TITLE_TO_LEDE) },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: s(CHIP_GAP),
    marginTop: s(HERO_TO_CHIPS),
  },
  heading: { marginBottom: s(HEADING_TO_CARDS) },
  cardSlot: { paddingBottom: s(CARD_GAP) },
}));
