import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import type { Application, Job } from '@/data/models';
import { JOB_SORT_LABEL } from '@/data/models';
import {
  useApplications,
  useJobs,
  useSavedJobs,
  useTodaysPicks,
  useToggleSaveJob,
  useUnreadCount,
} from '@/data/queries';
import { a11yButton, hitSlop8, pluralize, useDebouncedValue } from '@/lib';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { JobCard } from '../components/JobCard';
import { JobsHeader } from '../components/JobsHeader';
import { SortControl } from '../components/SortControl';
import { TodaysPicks } from '../components/TodaysPicks';
import {
  appliedPills,
  appliedPillsLabel,
  discoverPills,
  discoverPillsLabel,
  savedPills,
  savedPillsLabel,
} from '../components/jobPillRows';
import { useJobsActions } from '../hooks/useJobsActions';
import { appliedFilterChips, isRemoteOnly, useJobsStore, type JobsSegment } from '../jobsStore';

const SEGMENTS: readonly Segment<JobsSegment>[] = [
  { key: 'discover', label: 'Discover' },
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
];

/** Figma 1:270 / 1:406 / 1:521 — each tab searches a different set. */
const PLACEHOLDER: Record<JobsSegment, string> = {
  discover: 'Job title, company, skill',
  saved: 'Search saved jobs',
  applied: 'Search your applications',
};

const STATUS_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'in_review', label: 'In review' },
  { key: 'interview', label: 'Interview' },
  { key: 'closed', label: 'Closed' },
] as const;

/** JOBS 01–03 — Discover, Saved and Applied as three segments of one screen. */
export function JobsScreen() {
  const { spacing } = useTheme();
  const actions = useJobsActions();
  const listRef = useRef<FlashListRef<JobRow>>(null);

  const segment = useJobsStore((state) => state.segment);
  const setSegment = useJobsStore((state) => state.setSegment);
  const queries = useJobsStore((state) => state.queries);
  const setQuery = useJobsStore((state) => state.setQuery);
  const filters = useJobsStore((state) => state.filters);
  const sort = useJobsStore((state) => state.sort);
  const appliedStatus = useJobsStore((state) => state.appliedStatus);
  const setAppliedStatus = useJobsStore((state) => state.setAppliedStatus);
  const location = useJobsStore((state) => state.location);
  const remoteOnly = isRemoteOnly(filters);
  const toggleRemoteOnly = useJobsStore((state) => state.toggleRemoteOnly);
  const removeFilter = useJobsStore((state) => state.removeFilter);
  const clearFilters = useJobsStore((state) => state.clearFilters);

  const query = queries[segment];
  const unread = useUnreadCount();
  const picks = useTodaysPicks();
  const toggleSave = useToggleSaveJob();

  // Discover searches server-side, so the term is debounced before it reaches the query key.
  const debouncedQuery = useDebouncedValue(query);
  const discover = useJobs({ ...filters, query: debouncedQuery || undefined }, sort);
  const saved = useSavedJobs();
  const applications = useApplications();

  const chips = useMemo(() => appliedFilterChips(filters), [filters]);

  const handleToggleSave = useCallback((job: Job) => toggleSave.mutate(job.id), [toggleSave]);

  const selectSegment = useCallback(
    (next: JobsSegment) => {
      setSegment(next);
      // The three segments share one list; without this you land mid-scroll in unrelated data.
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [setSegment],
  );

  // Each segment feeds the same list with its own rows.
  const rows = useMemo<JobRow[]>(() => {
    if (segment === 'discover') {
      const carousel = new Set((picks.data ?? []).map((job) => job.id));
      // A job already shown in "Today's picks" must not repeat as a row a few hundred px below.
      return (discover.data?.pages.flatMap((page) => page.items) ?? [])
        .filter((job) => !carousel.has(job.id))
        .map((job) => ({ kind: 'discover' as const, job }));
    }
    if (segment === 'saved') {
      const items = filterByQuery(saved.data ?? [], query);
      return items.map((job) => ({ kind: 'saved' as const, job }));
    }
    return (applications.data ?? [])
      .filter((row) => matchesStatusChip(row.application, appliedStatus))
      .filter((row) => matchesQuery(row.job, query))
      .map((row) => ({ kind: 'applied' as const, job: row.job, application: row.application }));
  }, [appliedStatus, applications.data, discover.data, picks.data, query, saved.data, segment]);

  const status = STATUS_OF[segment]({ discover, saved, applications });
  const activeQuery = segment === 'discover' ? discover : segment === 'saved' ? saved : applications;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Only the visible segment (plus the carousel it owns) needs re-fetching.
      await Promise.all([
        activeQuery.refetch(),
        ...(segment === 'discover' ? [picks.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [activeQuery, picks, segment]);

  const renderItem = useCallback(
    ({ item }: { item: JobRow }) => {
      if (item.kind === 'applied') {
        return (
          <JobCard
            job={item.job}
            affordance="open"
            pills={appliedPills(item.application)}
            onPress={actions.openJob}
            a11ySuffix={appliedPillsLabel(item.application)}
          />
        );
      }
      const isSaved = item.kind === 'saved';
      return (
        <JobCard
          job={item.job}
          affordance={isSaved || item.job.isSaved ? 'saved' : 'save'}
          pills={isSaved ? savedPills(item.job) : discoverPills(item.job)}
          a11ySuffix={isSaved ? savedPillsLabel(item.job) : discoverPillsLabel(item.job)}
          onPress={actions.openJob}
          onToggleSave={handleToggleSave}
        />
      );
    },
    [actions.openJob, handleToggleSave],
  );

  // Everything the list header renders from; changing any of it must repaint the header.
  const headerState = useMemo(
    () => ({ segment, chips, sort, appliedStatus, query, remoteOnly, location, count: rows.length }),
    [appliedStatus, chips, location, query, remoteOnly, rows.length, segment, sort],
  );

  const listHeader = (
    <View style={{ gap: spacing[5], paddingBottom: spacing[5] }}>
      <JobsHeader
        query={query}
        onChangeQuery={(value) => setQuery(segment, value)}
        placeholder={PLACEHOLDER[segment]}
        filterCount={segment === 'discover' ? chips.length : 0}
        hasUnread={(unread.data ?? 0) > 0}
        onPressNotifications={actions.openNotifications}
        onPressFilters={actions.openFilters}
      />

      {segment === 'discover' ? (
        <View style={[styles.chipRow, { gap: spacing[2] }]}>
          <FilterChip
            label={location}
            variant="picker"
            icon="map-marker-alt"
            onPress={actions.openLocationPicker}
          />
          <FilterChip
            label="Remote only"
            variant="toggle"
            selected={remoteOnly}
            onPress={toggleRemoteOnly}
          />
        </View>
      ) : null}

      <SegmentedControl segments={SEGMENTS} value={segment} onChange={selectSegment} />

      {segment === 'discover' ? (
        <>
          {chips.length > 0 ? (
            <View style={styles.filterRow}>
              <View style={[styles.chipRow, { gap: spacing[2], flex: 1 }]}>
                {chips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    variant="removable"
                    onPress={() => removeFilter(chip.key)}
                  />
                ))}
              </View>
              <Pressable
                {...a11yButton('Clear all filters')}
                feedback="subtle"
                haptic="selection"
                hitSlop={hitSlop8}
                onPress={clearFilters}
              >
                <Text variant="captionSemiBold">Clear all</Text>
              </Pressable>
            </View>
          ) : null}

          <TodaysPicks
            picks={picks.data}
            status={picks.isPending ? 'pending' : picks.isError ? 'error' : 'success'}
            onPressJob={actions.openJob}
            onToggleSave={handleToggleSave}
            onRetry={() => void picks.refetch()}
          />

          <View style={styles.filterRow}>
            <Text accessibilityRole="header" variant="section">
              All jobs
            </Text>
            <SortControl label={JOB_SORT_LABEL[sort]} onPress={actions.openSort} />
          </View>
        </>
      ) : segment === 'saved' ? (
        <View style={styles.filterRow}>
          <Text variant="caption" color="textSecondary">
            {pluralize(rows.length, 'saved job')}
          </Text>
          <SortControl label="Recently saved" onPress={actions.openSort} />
        </View>
      ) : (
        <View style={[styles.chipRow, { gap: spacing[2] }]}>
          {STATUS_CHIPS.map((chip) => (
            <FilterChip
              key={chip.key}
              label={
                chip.key === 'all' ? `All · ${applications.data?.length ?? 0}` : chip.label
              }
              variant="select"
              selected={appliedStatus === chip.key}
              onPress={() => setAppliedStatus(chip.key)}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Screen padded={false} tabBarInset>
      <FlashList
        ref={listRef}
        data={status === 'success' ? rows : []}
        renderItem={renderItem}
        keyExtractor={rowKey}
        getItemType={(row) => row.kind}
        ListHeaderComponent={listHeader}
        // The header is state-driven (segment, chips, sort, query). Virtualised lists only
        // re-render their header when something they track changes, so declare it here.
        extraData={headerState}
        ListEmptyComponent={
          <ListPlaceholder
            status={status}
            segment={segment}
            onRetry={() => {
              if (segment === 'discover') void discover.refetch();
              else if (segment === 'saved') void saved.refetch();
              else void applications.refetch();
            }}
            onBrowse={() => setSegment('discover')}
          />
        }
        ItemSeparatorComponent={RowSeparator}
        onEndReached={() => {
          if (segment === 'discover' && discover.hasNextPage && !discover.isFetchingNextPage) {
            void discover.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: spacing[4] }}
        refreshControl={
          <RefreshControl refreshing={refreshing || activeQuery.isRefetching} onRefresh={onRefresh} />
        }
      />
    </Screen>
  );
}

type JobRow =
  | { kind: 'discover'; job: Job }
  | { kind: 'saved'; job: Job }
  | { kind: 'applied'; job: Job; application: Application };

const rowKey = (row: JobRow) => (row.kind === 'applied' ? row.application.id : row.job.id);

function RowSeparator() {
  return <View style={{ height: 14 }} />;
}

const STATUS_OF: Record<
  JobsSegment,
  (queries: {
    discover: ReturnType<typeof useJobs>;
    saved: ReturnType<typeof useSavedJobs>;
    applications: ReturnType<typeof useApplications>;
  }) => 'pending' | 'error' | 'success'
> = {
  discover: ({ discover }) =>
    discover.isPending ? 'pending' : discover.isError ? 'error' : 'success',
  saved: ({ saved }) => (saved.isPending ? 'pending' : saved.isError ? 'error' : 'success'),
  applied: ({ applications }) =>
    applications.isPending ? 'pending' : applications.isError ? 'error' : 'success',
};

function ListPlaceholder({
  status,
  segment,
  onRetry,
  onBrowse,
}: {
  status: 'pending' | 'error' | 'success';
  segment: JobsSegment;
  onRetry: () => void;
  onBrowse: () => void;
}) {
  const { spacing } = useTheme();

  if (status === 'pending') {
    return (
      <View style={{ gap: 14 }}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={168} radius="cardLg" />
        ))}
      </View>
    );
  }

  if (status === 'error') {
    return (
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load jobs"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
        style={{ marginTop: spacing[6] }}
      />
    );
  }

  const empty = EMPTY_COPY[segment];
  return (
    <StateView
      icon={empty.icon}
      title={empty.title}
      message={empty.message}
      actionLabel={segment === 'discover' ? undefined : 'Browse jobs'}
      onAction={segment === 'discover' ? undefined : onBrowse}
      style={{ marginTop: spacing[6] }}
    />
  );
}

const EMPTY_COPY: Record<JobsSegment, { icon: string; title: string; message: string }> = {
  discover: {
    icon: 'briefcase',
    title: 'No jobs match these filters',
    message: 'Try widening your filters or clearing a few.',
  },
  saved: {
    icon: 'bookmark',
    title: 'Nothing saved yet',
    message: 'Tap the bookmark on a job to keep it here.',
  },
  applied: {
    icon: 'paper-plane',
    title: 'No applications yet',
    message: 'Jobs you apply to will show up here with their status.',
  },
};

const normalise = (value: string) => value.trim().toLowerCase();

function matchesQuery(job: Job, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return [job.title, job.company, job.location].some((field) => normalise(field).includes(needle));
}

function filterByQuery(jobs: Job[], query: string): Job[] {
  return query ? jobs.filter((job) => matchesQuery(job, query)) : jobs;
}

function matchesStatusChip(application: Application, chip: string): boolean {
  switch (chip) {
    case 'in_review':
      return application.status === 'in_review' || application.status === 'viewed';
    case 'interview':
      return application.status === 'interview' || application.status === 'offer';
    case 'closed':
      return application.status === 'not_selected' || application.status === 'withdrawn';
    default:
      return true;
  }
}


const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
