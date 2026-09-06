import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { INTERVIEW_DISCLAIMER, type InterviewSet } from '@/data/models';
import { useInterviewSets, useRemoveInterviewSet } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { InterviewSetCard } from '../components/InterviewSetCard';
import { useInterviewActions } from '../hooks/useInterviewActions';
import { useInterviewStore } from '../interviewStore';

const CTA = 'New question set';
/** A card is a title, a caption, a summary line and a bar — about this tall. */
const CARD_SKELETON = 120;

/**
 * INTERVIEW — the practice sets (V2 §7.15). No artboard covers it (plan §8, phase 9I); the
 * shape is the library's: cards, newest first, a sticky primary to make another.
 *
 * Every set is kept. Regenerating a resume's questions adds a set rather than replacing one
 * (§7.15's acceptance criterion), so the older one is captioned "Earlier set" and stays openable.
 */
export function InterviewListScreen() {
  const { spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();
  const actions = useInterviewActions();

  const sets = useInterviewSets();
  const remove = useRemoveInterviewSet();

  const deleteTarget = useInterviewStore((state) => state.deleteTarget);
  const deleteOpen = useInterviewStore((state) => state.deleteOpen);
  const requestDelete = useInterviewStore((state) => state.requestDelete);
  const closeDelete = useInterviewStore((state) => state.closeDelete);

  // A set is superseded when a newer one exists for the same target. Computed once per list.
  const superseded = useMemo(() => {
    const newest = new Set<string>();
    const result = new Set<string>();
    for (const set of sets.data ?? []) {
      const key = set.resumeId ?? `standalone:${set.roleTitle ?? ''}`;
      if (newest.has(key)) result.add(set.id);
      else newest.add(key);
    }
    return result;
  }, [sets.data]);

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * motion.stagger.card).duration(
          motion.durations.base,
        );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Interview prep" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        footer={footer}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[4] }}
      >
        {children}
      </Screen>
      {/* A sibling of the page, never a child of its scroller: the sheet's root is an absolute fill. */}
      {deleteTarget ? (
        <ConfirmSheet
          open={deleteOpen}
          title="Delete this practice set?"
          message={`"${deleteTarget.title}" and the marks you left on it will be gone. Any other sets stay.`}
          confirmLabel="Delete"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget.id, { onSettled: closeDelete })}
          onCancel={closeDelete}
        />
      ) : null}
    </>
  );

  // The inert bar is part of the loading state: it owns the bottom inset, so a page without one
  // would grow a footer out of nothing when the list lands.
  if (sets.isPending) {
    return page(
      <View style={{ gap: spacing[4] }}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={s(CARD_SKELETON)} radius="card" />
        ))}
      </View>,
      <StickyActionBar primary={{ label: CTA, disabled: true }} />,
    );
  }

  if (sets.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your practice sets"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void sets.refetch()}
      />,
    );
  }

  const list = sets.data ?? [];
  if (list.length === 0) {
    return page(
      <StateView
        icon="comments"
        title="No practice sets yet"
        message="Questions are written from a resume and the job it was tailored to, so you can defend every line — or from a role title alone."
        actionLabel={CTA}
        onAction={() => actions.openNew()}
      />,
      <StickyActionBar primary={{ label: CTA, icon: 'plus', onPress: () => actions.openNew() }} />,
    );
  }

  return page(
    <>
      {list.map((set: InterviewSet, index) => (
        <Animated.View key={set.id} entering={enter(index)}>
          <InterviewSetCard
            set={set}
            superseded={superseded.has(set.id)}
            onOpen={(item) => actions.openSet(item.id)}
            onLongPress={requestDelete}
          />
        </Animated.View>
      ))}
      <Text
        variant="captionSm"
        color="textTertiary"
        align="center"
        style={{ marginTop: spacing[2] }}
      >
        {INTERVIEW_DISCLAIMER}
      </Text>
    </>,
    <StickyActionBar primary={{ label: CTA, icon: 'plus', onPress: () => actions.openNew() }} />,
  );
}
