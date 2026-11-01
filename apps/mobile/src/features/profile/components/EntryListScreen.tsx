import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { FactKind, Profile } from '@/data/models';
import { useConfirmFacts, useProfile } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { NoteBar } from '@/ui/NoteBar';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import type { EntryRow } from '../entryRows';
import { EntryListEmpty, type EntryListEmptyConfig } from './EntryListEmpty';
import { FactSource } from './FactSource';
import { useProfileActions } from '../hooks/useProfileActions';
import { AddCard, EntryCard, SectionHeading, StatusPill, SummaryCard, tileFor } from './cards';
import type { LineIconName } from '@/ui/Icon';

/** A card plus the optional second target the Links list gives it ("Open"). */
export type EntryListRow = EntryRow & {
  action?: { icon: LineIconName; label: string; onPress: () => void };
};

export type EntryListScreenProps = {
  title: string;
  /** What this list's facts are, for a confirmation. Links aren't facts, so they have none. */
  kind?: FactKind;
  /** Reads this list's cards off the profile — see `entryRows`. */
  select: (profile: Profile) => EntryListRow[];
  /** The head card: the list's icon, "4 roles on your profile", and why the list matters. */
  summary: { art: ListRowArt; artWidth?: number; title: (count: number) => string; lede: string };
  /** "Your roles" / "Newest first" over the cards. */
  heading: { title: string; note?: string };
  /** The dashed card that ends the list, and the empty state's button. */
  add: { title: string; caption: string };
  /** Opens one entry's form; `'new'` is the same form with nothing in it. */
  onOpen: (id: string) => void;
  /** PROFILE 10: what the list says while it is empty. */
  empty: EntryListEmptyConfig;
  /** The lavender line under the list — Links' §6.2 note (577:9086). */
  note?: { text: string; icon?: LineIconName };
  /** Rendered as a sibling of the page, never inside its scroller (toasts, sheets). */
  overlay?: ReactNode;
};

const NEW = 'new';

// The list's rhythm at 390 (PROFILE 04 573:2), in artboard units.
const SUMMARY_TO_HEADING = 24 / 0.75;
const HEADING_TO_CARDS = 12 / 0.75;
const CARD_STEP = 12 / 0.75;
const NOTE_TOP = 14 / 0.75;
const SKELETON_HEAD = 100 / 0.75;
const SKELETON_CARD = 112 / 0.75;

/**
 * The shape all four career-profile lists share (V2 §7.3, PROFILE 04 / 07 / 10 / 12): a summary
 * card, the entries as cards newest first, and a dashed card to add one more. The add card sits at
 * the end of the list rather than on a pinned bar, as the boards draw it.
 *
 * Deleting deliberately lives in the entry's form, not here: a swipe that destroys a card without
 * showing what it holds is the one edit this list would not let the user check first.
 */
export function EntryListScreen({
  title,
  kind,
  select,
  summary,
  heading,
  add,
  onOpen,
  empty,
  note,
  overlay,
}: EntryListScreenProps) {
  const { motion, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useProfileActions();
  const profile = useProfile();
  const confirm = useConfirmFacts();

  const page = (children: ReactNode) => (
    <View style={rootStyle.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={title} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[6] }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        {children}
      </Screen>
      {overlay}
    </View>
  );

  if (profile.isPending) {
    return page(
      <View style={{ gap: s(CARD_STEP) }}>
        <Skeleton height={s(SKELETON_HEAD)} radius="cardLg" />
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={s(SKELETON_CARD)} radius="cardLg" />
        ))}
      </View>,
    );
  }

  if (profile.isError || !profile.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void profile.refetch()}
      />,
    );
  }

  const rows = select(profile.data);
  const noteBar = note ? (
    <NoteBar text={note.text} icon={note.icon} style={{ marginTop: s(NOTE_TOP) }} />
  ) : null;

  if (rows.length === 0) {
    return page(
      <>
        <EntryListEmpty empty={empty} addLabel={add.title} onAdd={() => onOpen(NEW)} />
        {noteBar}
      </>,
    );
  }

  return page(
    <>
      <SummaryCard
        art={summary.art}
        artWidth={summary.artWidth}
        title={summary.title(rows.length)}
        lede={summary.lede}
      />
      <View style={styles.heading}>
        <SectionHeading title={heading.title} note={heading.note} />
      </View>
      <View style={{ gap: s(CARD_STEP) }}>
        {rows.map((row, index) => (
          <Animated.View
            key={row.id}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
          >
            <EntryCard
              tile={tileFor(row.tile)}
              title={row.title}
              subtitle={row.subtitle}
              meta={row.meta}
              pill={row.pill ? <StatusPill label={row.pill.label} tone={row.pill.tone} /> : null}
              chips={row.tags}
              action={row.action}
              footer={
                row.source && kind ? (
                  <FactSource
                    provenance={row.source}
                    what={row.title}
                    onConfirm={() => confirm.mutate({ kind, id: row.id })}
                  />
                ) : undefined
              }
              onPress={() => onOpen(row.id)}
            />
          </Animated.View>
        ))}
        <AddCard title={add.title} caption={add.caption} onPress={() => onOpen(NEW)} />
      </View>
      {noteBar}
    </>,
  );
}

const useStyles = scaledSheet((s) => ({
  heading: { marginTop: s(SUMMARY_TO_HEADING), marginBottom: s(HEADING_TO_CARDS) },
}));

const rootStyle = StyleSheet.create({
  root: { flex: 1 },
});
