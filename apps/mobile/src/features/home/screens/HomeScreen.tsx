import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, type ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  qk,
  queryPhase,
  useCurrentUser,
  useDashboardStats,
  useJobPicks,
  usePrefetchActiveGeneration,
  useResumes,
  useUnreadCount,
} from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StateView } from '@/ui/StateView';
import { layoutTransition } from '@/ui/motion';

import { ActiveGenerationCard } from '../components/ActiveGenerationCard';
import { BrandBlock } from '../components/BrandBlock';
import { HeroBlock } from '../components/HeroBlock';
import { HomeHeader } from '../components/HomeHeader';
import { HomeSkeleton } from '../components/HomeSkeleton';
import { QuickStartCard } from '../components/QuickStartCard';
import { ResumeProgressCard } from '../components/ResumeProgressCard';
import { ShortcutGrid } from '../components/ShortcutGrid';
import { TopJobMatches } from '../components/TopJobMatches';
import { useCopiedJobLink } from '../hooks/useCopiedJobLink';
import { useHomeActions } from '../hooks/useHomeActions';

const SECTION_GAP = 16;

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
          ? FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base)
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
  const { spacing, s } = useTheme();
  const actions = useHomeActions();
  // TAILOR 00c: a job link on the clipboard is asked about while Home is in view.
  useCopiedJobLink();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();

  const user = useCurrentUser();
  const picks = useJobPicks();
  const resumes = useResumes();
  const stats = useDashboardStats();
  const unread = useUnreadCount();
  // The progress card subscribes to the live run itself; this only starts its fetch alongside
  // the rest, without re-rendering Home on every tick.
  usePrefetchActiveGeneration();

  const scrollRef = useRef<ScrollView>(null);
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
    />
  );

  // Data-first: a failed background refresh keeps the dashboard on screen.
  if (queryPhase(user) === 'error') {
    // The header stays, as on every other tab's error state: the bell and the menu still work.
    return (
      <Screen header={header} headerStyle={{ paddingTop: spacing.headerTop }}>
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Something went wrong"
          message="We couldn't load your dashboard. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      tabBarInset
      scrollRef={scrollRef}
      // The header's own top padding moved to `headerStyle`; `paddingTop` here replaces the
      // first `gap` instance, which left with it. Not both — that would double to 24.
      contentContainerStyle={{ paddingTop: s(SECTION_GAP), gap: s(SECTION_GAP) }}
      refreshControl={refreshControl}
      headerStyle={{ paddingTop: spacing.headerTop }}
      header={header}
    >
      {user.isPending ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* Subscribes to the live run itself, so its ticks re-render the card, not Home. */}
          <ActiveGenerationCard onView={actions.openGeneration} onRetry={actions.retryGeneration} />
          <Section index={0} animate={animate}>
            <BrandBlock />
          </Section>
          <Section index={1} animate={animate}>
            <HeroBlock onFindJobs={actions.findJobs} />
          </Section>
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
          </Section>
          <Section index={4} animate={animate}>
            <ResumeProgressCard
              resume={latestResume}
              status={queryPhase(resumes)}
              onViewAll={actions.viewAllResumes}
              onPressResume={actions.openResume}
              onCreateResume={actions.createResume}
              onRetry={() => void resumes.refetch()}
            />
          </Section>
          <Section index={5} animate={animate}>
            <ShortcutGrid stats={stats.data} onShortcut={actions.shortcut} />
          </Section>
        </>
      )}
    </Screen>
  );
}
