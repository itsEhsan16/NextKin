import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { ConfirmArt, ConfirmSheet } from '@/ui/ConfirmSheet';
import type { ListRowArt } from '@/ui/ListRow';
import { NoteBar } from '@/ui/NoteBar';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import {
  addChip,
  atCap,
  capNote,
  DISCARD_TITLE,
  filterSuggestions,
  removeChip,
} from '../chipEdits';
import { DISCARD_MESSAGE, SAVE_FAILED } from '../profileForms';
import { CARD_GAP, SectionCard, SummaryCard } from './cards';
import { ChipField, ChipListSkeleton, SuggestedLabel, SuggestionChips } from './ChipListParts';

export type ChipListEditorProps = {
  title: string;
  /** The head card (PROFILE 09 577:7984): the list's icon, where it stands, and a lede or meter. */
  summary: { art: ListRowArt; artWidth?: number; title: string; lede?: string; progress?: number };
  /** The list card's title — "Your skills", "Cities". */
  listTitle: string;
  /** Names one entry — "skill", "desired role", "location". */
  noun: string;
  items: readonly string[];
  /** The shipped vocabulary offered as suggestions (`@/data/models`). */
  suggestions: readonly string[];
  placeholder: string;
  /** The add field's accessible label — "Add a skill". */
  addLabel: string;
  max?: number;
  /** Said in place of the chips while there are none. */
  emptyMessage?: string;
  /**
   * Skills and Desired roles give the suggestions a card of their own (577:8048); Locations keeps
   * them under its field with a "Suggested" label (580:1783).
   */
  suggestionsIn: 'card' | 'list';
  onChange: (next: string[]) => void;
  /** Rendered under the list — Locations puts its remote chooser card here. */
  below?: ReactNode;
  /** The lavender line at the foot of the page, on what the answer is used for (577:8071). */
  note: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  dirty: boolean;
  saving: boolean;
  failed: boolean;
  onSave: () => void;
  /** Leaves the page — `router.back()`, once the discard question has been answered. */
  onClose: () => void;
};

const SKELETON_HEAD = 100 / 0.75;

/**
 * The page all three §7.3 chip screens are (PROFILE 09 / 15 / 16): a summary card, the editable
 * list in a card, its suggestions, an optional extra card, a lavender note, and a Save that stays
 * inert until something has actually changed.
 *
 * The draft lives in the screen above rather than here, because a screen can hold more than the
 * list — Locations edits a remote preference in the same save — and `dirty` has to account for
 * all of it before Save goes live.
 */
export function ChipListEditor({
  title,
  summary,
  listTitle,
  noun,
  items,
  suggestions,
  placeholder,
  addLabel,
  max,
  emptyMessage,
  suggestionsIn,
  onChange,
  below,
  note,
  loading,
  error,
  onRetry,
  dirty,
  saving,
  failed,
  onSave,
  onClose,
}: ChipListEditorProps) {
  const { spacing, s } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(SAVE_FAILED);
  }, [failed]);

  /**
   * The one way off this page. Android's hardware back is not intercepted here: `BackHandler` is
   * owned by `Sheet` alone in this codebase, and the discard sheet already claims it while it is
   * open. The header chevron is the affordance that asks the question.
   */
  const requestBack = () => (dirty ? setConfirmOpen(true) : onClose());

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={title} onBack={requestBack} />}
        headerStyle={{ paddingBottom: spacing[6] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: s(CARD_GAP) }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* A sibling of the page, never a child of its scroller. */}
      <ConfirmSheet
        open={confirmOpen}
        title={DISCARD_TITLE}
        message={DISCARD_MESSAGE}
        art={<ConfirmArt kind="discard" />}
        artGap={0}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the profile lands.
  if (loading) {
    return page(
      <>
        <Skeleton height={s(SKELETON_HEAD)} radius="cardLg" />
        <ChipListSkeleton />
      </>,
      <StickyActionBar floating primary={{ label: 'Save changes', disabled: true }} />,
    );
  }

  if (error) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />,
    );
  }

  const full = atCap(items, max);
  const offered = full ? [] : filterSuggestions(suggestions, items, '');
  const add = (value: string): string | undefined => {
    const result = addChip(items, value, noun, max);
    if ('refused' in result) return result.refused;
    onChange(result.items);
    return undefined;
  };
  const suggestionChips = (
    <SuggestionChips noun={noun} items={offered} onAdd={(item) => void add(item)} />
  );

  return page(
    <>
      <SummaryCard {...summary} />

      <SectionCard title={listTitle}>
        <ChipField
          noun={noun}
          items={items}
          placeholder={placeholder}
          addLabel={addLabel}
          onAdd={add}
          onRemove={(item) => onChange(removeChip(items, item))}
          fullNote={full && max != null ? capNote(max) : undefined}
          emptyMessage={emptyMessage}
        />
        {suggestionsIn === 'list' && offered.length > 0 ? (
          <>
            <SuggestedLabel />
            {suggestionChips}
          </>
        ) : null}
      </SectionCard>

      {suggestionsIn === 'card' && offered.length > 0 ? (
        <SectionCard title="Suggested">{suggestionChips}</SectionCard>
      ) : null}

      {below}

      <NoteBar text={note} />
    </>,
    <StickyActionBar
      floating
      note={failed ? SAVE_FAILED : undefined}
      noteTone="danger"
      primary={{
        label: 'Save changes',
        loading: saving,
        // A failure leaves the button live, so pressing it again is the retry.
        disabled: !dirty,
        onPress: onSave,
      }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
