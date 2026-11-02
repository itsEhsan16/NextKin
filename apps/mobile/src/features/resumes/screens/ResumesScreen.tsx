import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Resume } from '@/data/models';
import { queryPhase, useResumes, useSubscription, useUnreadCount } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { columnWidth, useLayoutScale, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { itemEnter, itemExit, layoutTransition, useRevealStagger } from '@/ui/motion';

import { NewDocRow, NewDocTile } from '../components/NewDocCard';
import { ResumeGridCard } from '../components/ResumeGridCard';
import { ResumeListRow } from '../components/ResumeListRow';
import { ResumesFirstRun } from '../components/ResumesFirstRun';
import { ResumesFilterBar } from '../components/ResumesFilterBar';
import { ResumesHeader } from '../components/ResumesHeader';
import { useResumesActions } from '../hooks/useResumesActions';
import { useResumesStore } from '../resumesStore';

/** Column gap from the artboard: 228 + 16 + 228 fills the 472pt content width. */
const GRID_GAP = 16;
/** Rows sit looser than columns: 480.5 → 499 on the 390 board (95:1555 → 95:1585), 18.5 / 0.75. */
const ROW_GAP = 25;
/**
 * List rows sit 14.5 apart on the 390 board (95:1769, 151:2), and the "+ New" row 18 above the
 * first one: 19 and 24 in artboard units. The extra 5 rides on the New row as a margin.
 */
const LIST_GAP = 19;
const NEW_ROW_GAP = 24;
/** The usage bar 95:1554 ends at 223 and the first card 95:1555 starts at 251: 28 / 0.75. */
const HEADER_GAP = 37;
/** The dashed tile keeps the artboard card proportions so both grid columns align. */
const NEW_TILE_RATIO = 228 / 306;

const normalise = (value: string) => value.trim().toLowerCase();

function matchesQuery(resume: Resume, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return [resume.title, resume.targetCompany ?? '', resume.targetRole ?? ''].some((field) =>
    normalise(field).includes(needle),
  );
}

/**
 * RESUMES 01/02 — the document library with a persisted grid ⇄ list toggle.
 *
 * Deliberately a ScrollView rather than FlashList (§5): the toggle morphs every card between
 * two layouts with a LinearTransition, which needs the cards to stay mounted — a recycler
 * would re-issue them and the morph would become a cut. The library is bounded (the free plan
 * caps it; even heavy Pro use is dozens, not hundreds), so virtualisation buys nothing here.
 */
export function ResumesScreen() {
  const { spacing, s } = useTheme();
  const { contentWidth } = useLayoutScale();
  const reduced = useReducedMotion();
  const actions = useResumesActions();

  const viewMode = useResumesStore((state) => state.viewMode);
  const setViewMode = useResumesStore((state) => state.setViewMode);
  const typeFilter = useResumesStore((state) => state.typeFilter);
  const setTypeFilter = useResumesStore((state) => state.setTypeFilter);
  const query = useResumesStore((state) => state.query);
  const setQuery = useResumesStore((state) => state.setQuery);
  const sort = useResumesStore((state) => state.sort);

  // Sorted in the query's `select`, so the filters below never re-order and the cache is shared.
  const resumes = useResumes(sort);
  const subscription = useSubscription();
  const unread = useUnreadCount();

  const scrollRef = useRef<ScrollViewInstance>(null);
  useTabScrollToTop(
    'resumes',
    useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([resumes.refetch(), subscription.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [resumes, subscription]);

  // The library shows finished documents only; the in-flight generation lives on Home's
  // progress card and would otherwise float to the top of this list mid-generation.
  const library = useMemo(
    () => (resumes.data ?? []).filter((resume) => resume.status === 'ready'),
    [resumes.data],
  );

  const docs = useMemo(
    () =>
      library
        .filter((resume) => typeFilter === 'all' || resume.docType === typeFilter)
        .filter((resume) => matchesQuery(resume, query)),
    [library, query, typeFilter],
  );

  const grid = viewMode === 'grid';
  // `contentWidth` is device space, so the gap taken out of it must be too, and the same value
  // has to be the actual gap below. Both columns then come off `columnWidth`, which is what keeps
  // the row *under* the container rather than exactly on it — see its doc for why the exact form
  // collapsed this grid to a single column on a 411dp phone.
  const gridGap = s(GRID_GAP);
  const cardWidth = columnWidth(contentWidth, gridGap);
  const status = queryPhase(resumes);
  const enter = useRevealStagger(status !== 'pending');

  // First run replaces the whole tab (RESUMES 05) — chrome included, bar the title row.
  if (status === 'success' && library.length === 0) {
    return (
      // The first-run block centres in the space under the title row, a little above the middle
      // as RESUMES 05 draws it (toreview.md 38.1); the header keeps its own top padding.
      <Screen
        scroll
        tabBarInset
        scrollRef={scrollRef}
        contentContainerStyle={styles.firstRun}
        headerStyle={{ paddingTop: spacing.headerTop }}
        header={
          <ResumesHeader
            firstRun
            hasUnread={(unread.data ?? 0) > 0}
            onPressNotifications={actions.openNotifications}
          />
        }
      >
        <ResumesFirstRun
          onUpload={actions.uploadResume}
          onImportLinkedIn={actions.importLinkedIn}
          onStartWithAi={actions.startWithAi}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      tabBarInset
      scrollRef={scrollRef}
      contentContainerStyle={{ gap: s(HEADER_GAP) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      headerStyle={{ paddingTop: spacing.headerTop }}
      header={
        <ResumesHeader
          query={query}
          onChangeQuery={setQuery}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          hasUnread={(unread.data ?? 0) > 0}
          onPressNotifications={actions.openNotifications}
        />
      }
    >
      {/*
        Stays a single child alongside the content branch below, so `gap: s(HEADER_GAP)` keeps
        meaning "last chrome block → first card". Promoting the meter to a third child would fire
        the gap between it and the pills and draw 45 where the artboard wants 21.
      */}
      <ResumesFilterBar
        typeFilter={typeFilter}
        onChangeTypeFilter={setTypeFilter}
        subscription={subscription.data}
        sort={sort}
        onPressSort={actions.openSort}
        onPressUpgrade={actions.openUpgrade}
      />

      {status === 'pending' ? (
        <View style={[styles.grid, { rowGap: s(ROW_GAP), columnGap: gridGap }]}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              width={cardWidth}
              height={cardWidth / NEW_TILE_RATIO}
              radius="card"
            />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn't load your documents"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void resumes.refetch()}
        />
      ) : docs.length === 0 ? (
        // The library has documents but the search / type pills matched none of them.
        <StateView
          icon="SearchLg"
          title="No documents match"
          actionLabel="Clear search"
          onAction={() => {
            setQuery('');
            setTypeFilter('all');
          }}
        />
      ) : (
        <View
          style={[
            styles.grid,
            grid ? { rowGap: s(ROW_GAP), columnGap: gridGap } : { gap: s(LIST_GAP) },
          ]}
        >
          <Animated.View
            key="new"
            layout={layoutTransition(reduced)}
            style={
              grid
                ? { width: cardWidth }
                : [styles.fullWidth, { marginBottom: s(NEW_ROW_GAP - LIST_GAP) }]
            }
          >
            {grid ? (
              <NewDocTile onPress={actions.openCreate} style={{ aspectRatio: NEW_TILE_RATIO }} />
            ) : (
              <NewDocRow onPress={actions.openCreate} />
            )}
          </Animated.View>

          {docs.map((resume, index) => (
            <Animated.View
              key={resume.id}
              layout={layoutTransition(reduced)}
              // Staggered in only when the library first loads; a card a filter brings back just
              // fades in, and one a filter (or a delete) takes away shrinks out.
              entering={enter(index) ?? itemEnter(reduced)}
              exiting={itemExit(reduced)}
              style={grid ? { width: cardWidth } : styles.fullWidth}
            >
              {grid ? (
                <ResumeGridCard
                  resume={resume}
                  onPress={actions.openDocument}
                  onOpenMenu={actions.openMenu}
                  onOpenScore={actions.openScore}
                />
              ) : (
                <ResumeListRow
                  resume={resume}
                  onPress={actions.openDocument}
                  onOpenMenu={actions.openMenu}
                  onOpenScore={actions.openScore}
                />
              )}
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  fullWidth: { width: '100%' },
  firstRun: { flexGrow: 1, justifyContent: 'center' },
});
