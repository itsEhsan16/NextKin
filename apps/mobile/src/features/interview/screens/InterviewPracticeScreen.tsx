import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  INTERVIEW_DISCLAIMER,
  INTERVIEW_GENERIC_LABEL,
  INTERVIEW_PRACTICE_FILTERS,
  type InterviewMark,
  type InterviewPracticeFilter,
} from '@/data/models';
import { useInterviewSet, useMarkInterviewQuestion } from '@/data/queries';
import { haptics } from '@/lib';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/Progress';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { QuestionCard } from '../components/QuestionCard';
import { useInterviewActions } from '../hooks/useInterviewActions';
import { useInterviewStore } from '../interviewStore';
import { marksLine, nextMark, positionLine, practiceView } from '../practiceRows';

export type InterviewPracticeScreenProps = { id: string };

const FILTERS: readonly Segment<InterviewPracticeFilter>[] = INTERVIEW_PRACTICE_FILTERS.map(
  (filter) => ({ key: filter.key, label: filter.label }),
);
const BAR_HEIGHT = 4;

/** The repo's not-found, recognised by shape — screens may not import `@/data/repos`. */
const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/**
 * PRACTICE (V2 §7.15): one question at a time, answer hidden until asked for, two marks that
 * persist, and the disclaimer the spec makes binding on every interview surface.
 *
 * Reveal state is local and keyed by question id: a per-index reset would re-hide an answer the
 * reader just opened when they page back, and it is a session affordance rather than a fact about
 * the set — so it is deliberately not persisted. The marks are.
 */
export function InterviewPracticeScreen({ id }: InterviewPracticeScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useInterviewActions();

  const set = useInterviewSet(id);
  const mark = useMarkInterviewQuestion(id);

  const filter = useInterviewStore((state) => state.filter);
  const snapshot = useInterviewStore((state) => state.filterSnapshot);
  const setFilter = useInterviewStore((state) => state.setFilter);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  // A fresh set opens on "All", with a snapshot of its own marks: a filter left over from another
  // set would otherwise apply here with the wrong snapshot.
  useEffect(() => {
    if (set.data) setFilter('all', set.data);
    // Only on the set's identity, not on every mark it receives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.data?.id]);

  const view = practiceView(set.data, filter, snapshot, index);
  const current = view.current;

  // Plain closures: the compiler memoises them, and a manual useCallback over `current` is what it
  // refuses to preserve.
  const toggleReveal = () => {
    if (!current) return;
    setRevealed((old) => {
      const next = new Set(old);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  };

  const applyMark = (pressed: Exclude<InterviewMark, 'unmarked'>) => {
    if (!current) return;
    const next = nextMark(current.mark, pressed);
    if (next === 'confident') void haptics.success();
    mark.mutate({ questionId: current.id, mark: next });
  };

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={set.data?.title ?? 'Practice'} onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      footer={footer}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
    >
      {children}
    </Screen>
  );

  if (id.length > 0 && set.isPending) {
    return page(
      <View style={{ gap: spacing[4] }}>
        <Skeleton height={s(44)} radius="full" />
        <Skeleton height={s(20)} width="40%" />
        <Skeleton height={s(320)} radius="card" />
      </View>,
      <StickyActionBar primary={{ label: 'Next', disabled: true }} />,
    );
  }

  // A set that is gone is not an outage: it gets the library, not a retry that cannot succeed.
  if (set.isError || !set.data) {
    return page(
      (set.isError && isMissing(set.error)) || (!set.isError && !set.data) ? (
        <StateView
          icon="comments"
          title="That practice set is gone"
          message="It may have been deleted. Your other sets are still here."
          actionLabel="Back to Interview prep"
          onAction={actions.openLibrary}
        />
      ) : (
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load this set"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void set.refetch()}
        />
      ),
    );
  }

  const data = set.data;
  const last = view.total > 0 && view.index === view.total - 1;

  return page(
    <>
      {data.source === 'standalone' ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip label={INTERVIEW_GENERIC_LABEL} tone="neutral" />
        </View>
      ) : null}

      <SegmentedControl
        segments={FILTERS}
        value={filter}
        onChange={(next) => {
          setFilter(next, data);
          setIndex(0);
        }}
      />

      <View style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            {positionLine(view)}
          </Text>
          <Text variant="caption" color="textSecondary">
            {marksLine(view.counts)}
          </Text>
        </View>
        <ProgressBar
          value={view.counts.total > 0 ? view.counts.marked / view.counts.total : 0}
          height={s(BAR_HEIGHT)}
          trackColor="progressTrack"
          fillColor="success"
          accessibilityLabel={`${view.counts.marked} of ${view.counts.total} questions marked`}
        />
      </View>

      {current ? (
        <QuestionCard
          question={current}
          revealed={revealed.has(current.id)}
          onToggleReveal={toggleReveal}
          onMark={applyMark}
        />
      ) : (
        // A filter with nothing under it, not a broken set: the way out is the filter itself.
        <StateView
          compact
          icon="check-circle"
          title={filter === 'needs_work' ? 'Nothing needs work' : 'Everything is marked'}
          message="Every question under this filter has been dealt with."
          actionLabel="Show all questions"
          onAction={() => {
            setFilter('all', data);
            setIndex(0);
          }}
        />
      )}

      {mark.isError ? (
        <Text variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
          {"That mark didn't save. Check your connection and try again."}
        </Text>
      ) : null}

      <Text variant="captionSm" color="textTertiary" align="center">
        {INTERVIEW_DISCLAIMER}
      </Text>
    </>,
    <StickyActionBar
      secondary={{
        label: 'Previous',
        disabled: view.index === 0,
        onPress: () => setIndex((i) => i - 1),
      }}
      primary={
        last || view.total === 0
          ? { label: 'Finish', onPress: actions.openLibrary }
          : { label: 'Next', onPress: () => setIndex((i) => i + 1) }
      }
    />,
  );
}
