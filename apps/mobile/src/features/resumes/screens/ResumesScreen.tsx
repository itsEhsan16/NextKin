import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ScrollView } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import type { Resume } from '@/data/models';
import { useResumes, useSubscription, useUnreadCount } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { columnWidth, useLayoutScale, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

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
/** 1:1392 usage bar ends at 262; the first card 1:1394 starts at 294. */
const HEADER_GAP = 32;
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
  const { motion, spacing, s } = useTheme();
  const { contentWidth } = useLayoutScale();
  const reduced = useReducedMotion();
  const actions = useResumesActions();

  const viewMode = useResumesStore((state) => state.viewMode);
  const setViewMode = useResumesStore((state) => state.setViewMode);
  const typeFilter = useResumesStore((state) => state.typeFilter);
  const setTypeFilter = useResumesStore((state) => state.setTypeFilter);
  const query = useResumesStore((state) => state.query);
  const setQuery = useResumesStore((state) => state.setQuery);

  const resumes = useResumes();
  const subscription = useSubscription();
  const unread = useUnreadCount();

  const scrollRef = useRef<ScrollView>(null);
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
  const status = resumes.isPending ? 'pending' : resumes.isError ? 'error' : 'success';

  // First run replaces the whole tab (RESUMES 05) — chrome included, bar the title row.
  if (status === 'success' && library.length === 0) {
    return (
      // No `contentContainerStyle` here on purpose: the 12 that was its `paddingTop` is now the
      // header's, and ResumesFirstRun brings its own `marginTop: spacing[10]` — keeping both
      // would make the seam 42 where the artboard draws 30.
      <Screen
        scroll
        tabBarInset
        scrollRef={scrollRef}
        headerStyle={{ paddingTop: spacing[4] }}
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
      headerStyle={{ paddingTop: spacing[4] }}
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
        onPressSort={actions.openSort}
        onPressUpgrade={actions.openUpgrade}
      />

      {status === 'pending' ? (
        <View style={[styles.grid, { gap: s(GRID_GAP) }]}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width={cardWidth} height={cardWidth / NEW_TILE_RATIO} radius="card" />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load your documents"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void resumes.refetch()}
          style={{ marginTop: spacing[6] }}
        />
      ) : docs.length === 0 ? (
        // The library has documents but the search / type pills matched none of them.
        <StateView
          icon="search"
          title="No documents match"
          message="Try a different search, or switch the type filter back to All."
          actionLabel="Clear search"
          onAction={() => {
            setQuery('');
            setTypeFilter('all');
          }}
          style={{ marginTop: spacing[6] }}
        />
      ) : (
        <View style={[styles.grid, { gap: grid ? gridGap : spacing[4] - s(2) }]}>
          <Animated.View
            key="new"
            layout={reduced ? undefined : LinearTransition.springify().duration(motion.durations.slow)}
            style={grid ? { width: cardWidth } : styles.fullWidth}
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
              layout={
                reduced ? undefined : LinearTransition.springify().duration(motion.durations.slow)
              }
              entering={
                reduced
                  ? undefined
                  : FadeInDown.delay(
                      Math.min(index, motion.stagger.maxItems) * motion.stagger.card,
                    ).duration(motion.durations.base)
              }
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
});
