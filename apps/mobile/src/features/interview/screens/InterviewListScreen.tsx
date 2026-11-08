import { useCallback, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { INTERVIEW_DISCLAIMER, type InterviewSet } from '@/data/models';
import { setForApplication } from '@/data/models';
import { useApplications, useInterviewSets, useRemoveInterviewSet } from '@/data/queries';
// Deep imports on purpose: those barrels drag their screens in. These are plain components.
import { FLOW_ART, FlowHero } from '@/features/create/components/FlowHero';
import { AddCard } from '@/features/profile/components/cards/EntryCards';
import { AiPill } from '@/features/resumes/components/AiPill';
import { formatWeekdayDate, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { NoteBar } from '@/ui/NoteBar';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { showAppToast } from '@/ui/Toast';
import { itemExit, layoutTransition, useRevealStagger } from '@/ui/motion';

import { InterviewSetCard } from '../components/InterviewSetCard';
import { useInterviewActions } from '../hooks/useInterviewActions';
import { useInterviewStore } from '../interviewStore';

const TITLE = 'Interview prep';
const LEDE = 'Practice questions written from your resume.';
/**
 * The delete is optimistic, so a refusal puts the card back; this says why it came back. It used
 * to reappear without a word (§85). The app-wide toast, since a pushed screen has no host of its own.
 */
export const DELETE_SET_FAILED =
  "We couldn't delete that set. Check your connection and try again.";
const NEW_TITLE = 'New question set';
const NEW_CAPTION =
  'Written from a resume and the job it was tailored to, or from a role title alone.';

// INTERVIEW 01 at 390 (577:927), in artboard units.
const HEADER_TO_ART = 41; // 577:934 → 674:17
const HERO_TO_SECTION = 17; // 577:957 → 577:959
const SECTION_TO_LIST = 12;
const CARD_GAP = 12; // 577:965 → 577:984
const LIST_TO_NOTE = 16; // 577:984 → 577:991
const ADD_HEIGHT = 90; // 577:984
/** A card with a two-line title, as the seeded set draws — the skeleton holds its place. */
const CARD_SKELETON = 140;

/**
 * INTERVIEW 01 (577:927) — the practice sets (V2 §7.15): the hero, every set newest first, the
 * dashed tile that writes a new one, and §7.15's disclaimer as the lavender note.
 *
 * Every set is kept. Regenerating a resume's questions adds a set rather than replacing one
 * (§7.15's acceptance criterion), so the older one is captioned "Earlier set" and stays openable.
 * The add tile ends the list in every state that has one, so there is no bottom bar.
 */
export function InterviewListScreen() {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useInterviewActions();
  const { openSet } = actions;
  // One handler for every card (§196): an arrow per card defeated InterviewSetCard's memo.
  const openCard = useCallback((set: InterviewSet) => openSet(set.id), [openSet]);

  const sets = useInterviewSets();
  const applications = useApplications();
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

  // The set an upcoming interview would practise from, marked with its day.
  const interviewDays = useMemo(() => {
    const days = new Map<string, string>();
    for (const { application } of applications.data ?? []) {
      if (application.status !== 'interview' || !application.interviewAt) continue;
      const set = setForApplication(sets.data ?? [], application);
      if (set) days.set(set.id, formatWeekdayDate(application.interviewAt));
    }
    return days;
  }, [applications.data, sets.data]);

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!sets.isPending);
  const reduced = useReducedMotion();

  const page = (children: ReactNode) => (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader
            title={TITLE}
            showTitle={false}
            onBack={actions.goBack}
            trailing={<AiPill />}
          />
        }
        headerStyle={styles.header}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
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
          onConfirm={() =>
            remove.mutate(deleteTarget.id, {
              onSettled: closeDelete,
              onError: () => showAppToast(DELETE_SET_FAILED, 'error'),
            })
          }
          onCancel={closeDelete}
        />
      ) : null}
    </>
  );

  const hero = (
    <Animated.View entering={enter(0)}>
      <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.interviewSets} />
    </Animated.View>
  );

  const section = (label: string, aside?: string) => (
    <View style={styles.section}>
      <Text variant="section" accessibilityRole="header" style={styles.grow}>
        {label}
      </Text>
      {aside ? (
        <Text variant="caption" color="textSecondary">
          {aside}
        </Text>
      ) : null}
    </View>
  );

  // The tile and the note close every loaded state; the tile is the page's one way to a new set.
  const footer = (index: number) => (
    <>
      <Animated.View entering={enter(index)} style={styles.listGap}>
        <AddCard
          title={NEW_TITLE}
          caption={NEW_CAPTION}
          onPress={() => actions.openNew()}
          style={styles.add}
        />
      </Animated.View>
      <Animated.View entering={enter(index + 1)} style={styles.note}>
        <NoteBar text={INTERVIEW_DISCLAIMER} />
      </Animated.View>
    </>
  );

  if (sets.isPending) {
    return page(
      <>
        {hero}
        {section('Your practice sets')}
        <View
          style={styles.list}
          accessible
          accessibilityLabel="Loading your practice sets"
          accessibilityState={{ busy: true }}
        >
          <Skeleton height={s(CARD_SKELETON / 0.75)} radius="cardLg" />
        </View>
      </>,
    );
  }

  if (sets.isError) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
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
      <>
        {hero}
        {section('No practice sets yet')}
        {footer(1)}
      </>,
    );
  }

  return page(
    <>
      {hero}
      {section('Your practice sets', 'Newest first')}
      <View style={styles.list}>
        {list.map((set: InterviewSet, index) => (
          <Animated.View
            key={set.id}
            entering={enter(index + 1)}
            // A deleted set shrinks away and the ones below glide up, rather than jumping.
            exiting={itemExit(reduced)}
            layout={layoutTransition(reduced)}
          >
            <InterviewSetCard
              set={set}
              superseded={superseded.has(set.id)}
              interviewDay={interviewDays.get(set.id)}
              onOpen={openCard}
              onLongPress={requestDelete}
            />
          </Animated.View>
        ))}
      </View>
      {footer(list.length + 1)}
    </>,
  );
}

const useStyles = scaledSheet((s) => ({
  header: { paddingBottom: s(HEADER_TO_ART / 0.75) },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8 / 0.75),
    marginTop: s(HERO_TO_SECTION / 0.75),
  },
  grow: { flex: 1 },
  list: { marginTop: s(SECTION_TO_LIST / 0.75), gap: s(CARD_GAP / 0.75) },
  listGap: { marginTop: s(CARD_GAP / 0.75) },
  add: { minHeight: s(ADD_HEIGHT / 0.75) },
  note: { marginTop: s(LIST_TO_NOTE / 0.75) },
}));
