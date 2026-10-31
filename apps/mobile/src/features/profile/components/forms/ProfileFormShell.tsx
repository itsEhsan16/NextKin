import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { useUnsavedGuard } from '@/navigation';
import { ConfirmArt, ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { DISCARD_MESSAGE, FIX_FIRST, SAVE_FAILED } from '../../profileForms';
import { CARD_GAP } from '../cards';
import { ProfileFormSkeleton } from './ProfileFormSkeleton';

export type ProfileFormStatus = 'loading' | 'error' | 'missing' | 'ready';

/** Editing only: the danger row at the foot of the form and the sheet behind it. */
export type ProfileFormRemove = {
  /** "Delete role" — names the entry on the row, in the sheet's title and on its confirm. */
  label: string;
  message: string;
  /** Leads the confirm (PROFILE 24 577:3383: the role icon in a red tint). */
  art?: ReactNode;
  busy: boolean;
  onConfirm: () => void;
};

export type ProfileFormShellProps = {
  title: string;
  status: ProfileFormStatus;
  /** A new entry saves with "Save"; an existing one with "Save changes" (577:8622 / 573:291). */
  isNew: boolean;
  /** The entry being edited, named in a card above the fields (573:152). New entries have none. */
  identity?: ReactNode;
  /** The list this entry belongs to, named by the missing state's action ("work experience"). */
  listLabel: string;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  /** Why a save was refused or failed. Sits on the bar that started the work. */
  note?: string;
  onSave: () => void;
  /** Leaves the page — after the discard question, when there is one to ask. */
  onLeave: () => void;
  onRetry: () => void;
  remove?: ProfileFormRemove;
  /** Rendered as siblings of the page: a sheet inside the scroller scrims the scroller. */
  sheets?: ReactNode;
  children: ReactNode;
};

/** V2 §7.6 forbids a silent failure; the reason goes on the bar that started the work. */
export const DELETE_FAILED = "We couldn't delete that. Check your connection and try again.";

/** The note the bar carries: a failure first, then whatever is still wrong on the form. */
export function formError(
  failed: boolean,
  deleteFailed: boolean,
  errors: object,
): string | undefined {
  if (failed) return SAVE_FAILED;
  if (deleteFailed) return DELETE_FAILED;
  return Object.keys(errors).length > 0 ? FIX_FIRST : undefined;
}

/** The last card → the Delete button (573:284). */
const DELETE_TOP = 18 / 0.75;

/**
 * The page all four profile entry forms wear (V2 §7.3, PROFILE 05 / 08 / 11 / 13): the entry's
 * identity card, its fields in cards, an outlined Delete, and a floating Save. Configured four
 * times rather than written four times — the four states, the bar, the discard question and the
 * delete confirm are the same page on each, and only the cards between them differ.
 *
 * Deleting lives here rather than on the list screens: the entry you are looking at is the one
 * you meant, and a swipe on a list is a different, easier gesture to make by accident.
 */
export function ProfileFormShell({
  title,
  status,
  isNew,
  identity,
  listLabel,
  dirty,
  valid,
  saving,
  note,
  onSave,
  onLeave,
  onRetry,
  remove,
  sheets,
  children,
}: ProfileFormShellProps) {
  const { spacing, s } = useTheme();
  const discard = useUnsavedGuard(status === 'ready' && dirty && !saving && !remove?.busy);
  const saveLabel = isNew ? 'Save' : 'Save changes';
  const [removeOpen, setRemoveOpen] = useState(false);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the reason is announced
  // explicitly as well — once per change, the way TextField announces its error.
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    const was = announced.current;
    announced.current = note;
    if (note && note !== was) AccessibilityInfo.announceForAccessibility(note);
  }, [note]);

  /**
   * The header chevron asks while there are edits; the edge swipe and Android's back are caught by
   * the same guard and land in the same sheet.
   */
  const { ask } = discard;
  const requestBack = useCallback(() => {
    if (status === 'ready' && dirty) ask(onLeave);
    else onLeave();
  }, [ask, dirty, onLeave, status]);

  const body =
    status === 'loading' ? (
      <ProfileFormSkeleton />
    ) : status === 'error' ? (
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    ) : status === 'missing' ? (
      <StateView
        icon="Folder"
        title="That entry no longer exists"
        actionLabel={`Back to ${listLabel}`}
        onAction={onLeave}
      />
    ) : (
      <>
        <View style={{ gap: s(CARD_GAP) }}>
          {identity}
          {children}
        </View>
        {remove ? (
          <Button
            label={remove.label}
            icon="Trash01"
            variant="dangerOutline"
            size="lg"
            block
            onPress={() => setRemoveOpen(true)}
            style={{ marginTop: s(DELETE_TOP) }}
          />
        ) : null}
      </>
    );

  // The bar is pinned while loading too: it owns the bottom safe-area inset, so a page without
  // one would grow a footer out of nothing the moment the profile lands.
  const footer =
    status === 'loading' ? (
      <StickyActionBar floating primary={{ label: saveLabel, disabled: true }} />
    ) : status === 'ready' ? (
      <StickyActionBar
        floating
        note={note}
        // `formError` only ever carries a failure or a form that still needs fixing.
        noteTone="danger"
        primary={{
          label: saveLabel,
          loading: saving,
          // A failure leaves the button live, so pressing it again is the retry.
          disabled: !dirty || !valid,
          onPress: onSave,
        }}
      />
    ) : undefined;

  return (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={title} onBack={requestBack} />}
        headerStyle={{ paddingBottom: spacing[6] }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        {body}
      </Screen>

      {/* Every sheet is a sibling of the page, never a child of its scroller. */}
      {sheets}

      <ConfirmSheet
        open={discard.open}
        title="Discard changes?"
        message={DISCARD_MESSAGE}
        art={<ConfirmArt kind="discard" />}
        artGap={0}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard.confirm}
        onCancel={discard.cancel}
      />

      {remove ? (
        <ConfirmSheet
          open={removeOpen}
          title={`${remove.label}?`}
          message={remove.message}
          art={remove.art}
          confirmLabel="Delete"
          busy={remove.busy}
          onConfirm={() => {
            setRemoveOpen(false);
            remove.onConfirm();
          }}
          onCancel={() => setRemoveOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
