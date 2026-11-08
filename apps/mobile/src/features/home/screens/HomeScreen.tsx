import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  qk,
  queryPhase,
  track,
  useCurrentUser,
  useDashboardStats,
  useHiddenPicks,
  useJobPicks,
  useResumes,
  useUnreadCount,
} from '@/data/queries';
import { useDueApplicationAsk } from '@/features/jobs';
import { useReducedMotion } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { GradientWash } from '@/ui/GradientWash';
import { StateView } from '@/ui/StateView';
import { layoutTransition } from '@/ui/motion';

import { HiddenPicksNote } from '../components/HiddenPicksNote';
import { HomeHeader } from '../components/HomeHeader';
import { HomeSkeleton } from '../components/HomeSkeleton';
import { QuickStartCard } from '../components/QuickStartCard';
import { ResumeProgressCard } from '../components/ResumeProgressCard';
import { ShortcutGrid } from '../components/ShortcutGrid';
import { TopJobMatches } from '../components/TopJobMatches';
import { useCopiedJobLink } from '../hooks/useCopiedJobLink';
import { useHomeActions } from '../hooks/useHomeActions';

const SECTION_GAP = 20;
/** How far the lavender wash reaches down Home, behind the greeting and the search (§176). */
const WASH = 340;

type SectionProps = { index: number; animate: boolean; children: ReactNode };

/**
 * Sections fade-slide in on first paint, 40ms apart (motion.stagger.card). Each also glides when
 * something above it changes size — the live run card arriving or retiring, a section's skeleton
 * giving way to its content — instead of jumping (§85).
 */
function Section({ index, animate, children }: SectionProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.delay(
              Math.min(index, motion.stagger.maxItems) * motion.stagger.card,
            ).duration(motion.durations.base)
          : undefined
      }
      layout={layoutTransition(reduced)}
    >
      {children}
    </Animated.View>
  );
}

/** DESIGN 2 — Spacing Fixed (Figma 1:2). */
export function HomeScreen() {
  const { spacing, s, u } = useTheme();
  const actions = useHomeActions();
  // TAILOR 00c: a job link on the clipboard is asked about while Home is in view.
  useCopiedJobLink();
  // A run finished last time, or yesterday's "not yet": asked once a visit.
  useDueApplicationAsk();
  useEffect(() => track('app_opened'), []);
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();

  const user = useCurrentUser();
  const picks = useJobPicks();
  const hiddenPicks = useHiddenPicks();
  const resumes = useResumes();
  const stats = useDashboardStats();
  const unread = useUnreadCount();
  // The progress card subscribes to the live run itself; this only starts its fetch alongside
  // the rest, without re-rendering Home on every tick.

  const scrollRef = useRef<ScrollViewInstance>(null);
  useTabScrollToTop(
    'index',
    useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.user.all }),
        queryClient.invalidateQueries({ queryKey: qk.jobs.picks() }),
        queryClient.invalidateQueries({ queryKey: qk.resumes.list() }),
        queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
        queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // "Your Resume Progress" = the most recently updated resume that has finished generating.
  const latestResume = useMemo(
    () =>
      resumes.data
        ?.filter((resume) => resume.status === 'ready')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    [resumes.data],
  );

  const animate = !reduced && !user.isPending;
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  const header = (
    <HomeHeader
      firstName={user.data?.firstName}
      avatarUrl={user.data?.avatarUrl}
      loading={user.isPending}
      hasUnread={(unread.data ?? 0) > 0}
      onPressNotifications={actions.openNotifications}
      onPressMenu={actions.openMenu}
      onSearch={user.isPending ? undefined : actions.findJobs}
    />
  );

  // Data-first: a failed background refresh keeps the dashboard on screen.
  if (queryPhase(user) === 'error') {
    // The header stays, as on every other tab's error state: the bell and the menu still work.
    return (
      <Screen header={header} headerStyle={{ paddingTop: spacing.headerTop }}>
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Something went wrong"
          message="We couldn't load your dashboard. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </Screen>
    );
  }

  return (
    // Home's header scrolls with the page, on the wash (§176): the greeting and search are its top.
    <Screen
      scroll
      tabBarInset
      padded={false}
      scrollRef={scrollRef}
      contentContainerStyle={{
        paddingTop: spacing.headerTop,
        paddingHorizontal: spacing.gutter,
        gap: s(SECTION_GAP),
      }}
      refreshControl={refreshControl}
    >
      <GradientWash height={u(WASH)} />
      {header}
      {user.isPending ? (
        <HomeSkeleton />
      ) : (
        <>
          <Section index={2} animate={animate}>
            <QuickStartCard onAction={actions.quickStart} />
          </Section>
          <Section index={3} animate={animate}>
            <TopJobMatches
              jobs={picks.data}
              status={queryPhase(picks)}
              onViewAll={actions.viewAllJobs}
              onPressJob={actions.openJob}
              onRetry={() => void picks.refetch()}
            />
            {hiddenPicks.data?.count ? (
              <HiddenPicksNote hidden={hiddenPicks.data} onPress={actions.viewDiscover} />
            ) : null}
          </Section>
          <Section index={4} animate={animate}>
            <ShortcutGrid stats={stats.data} onShortcut={actions.shortcut} />
          </Section>
          {/* With no resume yet there is no progress to show: the card stays away (§185–§187). */}
          {!latestResume && queryPhase(resumes) === 'success' ? null : (
            <Section index={5} animate={animate}>
              <ResumeProgressCard
                resume={latestResume}
                status={queryPhase(resumes)}
                onViewAll={actions.viewAllResumes}
                onPressResume={actions.openResume}
                onCreateResume={actions.createResume}
                onRetry={() => void resumes.refetch()}
              />
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
