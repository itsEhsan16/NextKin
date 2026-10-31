import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  INTERVIEW_DISCLAIMER,
  INTERVIEW_PRACTICE_FILTERS,
  type InterviewMark,
} from '@/data/models';
import { useInterviewSet, useMarkInterviewQuestion } from '@/data/queries';
import { haptics } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { FilterChip } from '@/ui/Chip';
import { NoteBar } from '@/ui/NoteBar';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { MarkSummary } from '../components/MarkSummary';
import { QuestionCard } from '../components/QuestionCard';
import { useInterviewActions } from '../hooks/useInterviewActions';
import { useInterviewStore } from '../interviewStore';
import { nextMark, positionLine, practiceView } from '../practiceRows';

export type InterviewPracticeScreenProps = { id: string };

// INTERVIEW 04 / 05 at 390 (577:3855 / 577:4905), in artboard units.
const HEADER_TO_CHIPS = 16; // 577:3862
const CHIP_GAP_X = 7;
const CHIP_GAP_Y = 8;
const CHIP_PAD_X = 14;
const CHIP_PAD_Y = 8;
const BLOCK_GAP = 14; // 577:3870 / 577:3886
const CARD_TO_NOTE = 16; // 577:3911
const PROGRESS_PAD = 15;
const PROGRESS_GAP = 10;
const PREVIOUS_W = 110; // 577:3921

/** The repo's not-found, recognised by shape — screens may not import `@/data/repos`. */
const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/**
 * INTERVIEW 04 / 05 (577:3855, 577:4905) — PRACTICE (V2 §7.15): one question at a time, the
 * filters as chips, the progress card, the answer hidden until asked for, two marks that
 * persist, and the disclaimer the spec makes binding on every interview surface.
 *
 * Reveal state is local and keyed by question id: a per-index reset would re-hide an answer the
 * reader just opened when they page back, and it is a session affordance rather than a fact about
 * the set — so it is deliberately not persisted. The marks are.
 */
export function InterviewPracticeScreen({ id }: InterviewPracticeScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
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

  // Plain closures: the React Compiler's lint (`preserve-manual-memoization`) rejects a manual
  // useCallback over `current`. Note the compiler itself is NOT enabled in this build
  // (`experiments.reactCompiler` is unset), so these are rebuilt every render and the one
  // `QuestionCard` re-renders with the screen — a single card, so the cost is small.
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
      headerStyle={styles.header}
      footer={footer}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      {children}
    </Screen>
  );

  if (id.length > 0 && set.isPending) {
    return page(
      <View
        style={styles.blocks}
        accessible
        accessibilityLabel="Loading the questions"
        accessibilityState={{ busy: true }}
      >
        <Skeleton height={s(34 / 0.75)} width="60%" radius="full" />
        <Skeleton height={s(96 / 0.75)} radius="cardLg" />
        <Skeleton height={s(320 / 0.75)} radius="cardLg" />
      </View>,
      <StickyActionBar floating primary={{ label: 'Next', disabled: true }} />,
    );
  }

  // A set that is gone is not an outage: it gets the library, not a retry that cannot succeed.
  if (set.isError || !set.data) {
    return page(
      (set.isError && isMissing(set.error)) || (!set.isError && !set.data) ? (
        <StateView
          icon="MessageChatSquare"
          title="That practice set is gone"
          message="It may have been deleted."
          actionLabel="Back to Interview prep"
          onAction={actions.openLibrary}
        />
      ) : (
        <StateView
          tone="danger"
          icon="AlertTriangle"
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
      <View style={styles.chips} accessibilityRole="radiogroup">
        {INTERVIEW_PRACTICE_FILTERS.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            variant="select"
            selected={filter === option.key}
            // Named apart from the mark of the same words: "Needs work" is also a button below.
            accessibilityLabel={`${option.label} questions`}
            hint="Filters the questions"
            onPress={() => {
              setFilter(option.key, data);
              setIndex(0);
            }}
            style={styles.chip}
          />
        ))}
      </View>

      <Card
        radius="cardLg"
        shadow="jobCard"
        padding={s(PROGRESS_PAD / 0.75)}
        style={styles.progress}
      >
        <View style={styles.position}>
          <Text variant="bodySemiBold" style={styles.grow} accessibilityLiveRegion="polite">
            {positionLine(view)}
          </Text>
          <Text variant="caption" color="textSecondary">
            {`${view.counts.marked} of ${view.counts.total} marked`}
          </Text>
        </View>
        <MarkSummary counts={view.counts} />
      </Card>

      <View style={styles.block}>
        {current ? (
          <QuestionCard
            question={current}
            revealed={revealed.has(current.id)}
            generic={data.source === 'standalone'}
            onToggleReveal={toggleReveal}
            onMark={applyMark}
          />
        ) : (
          // A filter with nothing under it, not a broken set: the way out is the filter itself.
          <StateView
            compact
            icon="CheckCircle"
            title={filter === 'needs_work' ? 'Nothing needs work' : 'Everything is marked'}
            actionLabel="Show all questions"
            onAction={() => {
              setFilter('all', data);
              setIndex(0);
            }}
          />
        )}
      </View>

      {mark.isError ? (
        <Text
          variant="caption"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          style={styles.block}
        >
          {"That mark didn't save. Check your connection and try again."}
        </Text>
      ) : null}

      <NoteBar text={INTERVIEW_DISCLAIMER} style={styles.note} />
    </>,
    <StickyActionBar
      floating
      secondary={{
        label: 'Previous',
        disabled: view.index === 0,
        onPress: () => setIndex((i) => i - 1),
        style: styles.previous,
      }}
      primary={
        last || view.total === 0
          ? { label: 'Finish', onPress: actions.openLibrary }
          : { label: 'Next', onPress: () => setIndex((i) => i + 1) }
      }
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  header: { paddingBottom: s(HEADER_TO_CHIPS / 0.75) },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(CHIP_GAP_X / 0.75),
    rowGap: s(CHIP_GAP_Y / 0.75),
  },
  chip: { paddingHorizontal: s(CHIP_PAD_X / 0.75), paddingVertical: s(CHIP_PAD_Y / 0.75) },
  progress: { marginTop: s(BLOCK_GAP / 0.75), gap: s(PROGRESS_GAP / 0.75) },
  position: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  grow: { flex: 1 },
  block: { marginTop: s(BLOCK_GAP / 0.75) },
  blocks: { gap: s(BLOCK_GAP / 0.75) },
  note: { marginTop: s(CARD_TO_NOTE / 0.75) },
  previous: { flexBasis: s(PREVIOUS_W / 0.75) },
}));
