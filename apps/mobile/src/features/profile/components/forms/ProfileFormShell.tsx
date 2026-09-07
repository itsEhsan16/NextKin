import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { DISCARD_MESSAGE, FIX_FIRST, SAVE_FAILED } from '../../profileForms';
import { ProfileFormSkeleton } from './ProfileFormSkeleton';

export type ProfileFormStatus = 'loading' | 'error' | 'missing' | 'ready';

/** Editing only: the danger row at the foot of the form and the sheet behind it. */
export type ProfileFormRemove = {
  /** "Delete role" — names the entry on the row, in the sheet's title and on its confirm. */
  label: string;
  message: string;
  busy: boolean;
  onConfirm: () => void;
};

export type ProfileFormShellProps = {
  title: string;
  status: ProfileFormStatus;
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

/**
 * The page all four profile entry forms wear (V2 §7.3). No artboard draws them (plan §8), so the
 * shell is assembled from the built primitives alone and configured four times rather than
 * written four times — the four states, the pinned bar, the discard question and the delete
 * confirm are the same page on each, and only the fields between them differ.
 *
 * Deleting lives here rather than on the list screens: the entry you are looking at is the one
 * you meant, and a swipe on a list is a different, easier gesture to make by accident.
 */
export function ProfileFormShell({
  title,
  status,
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
  const { spacing } = useTheme();
  const [discardOpen, setDiscardOpen] = useState(false);
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
   * The one way off this page. Android's hardware back is not intercepted: `BackHandler` is
   * owned by `Sheet` alone in this codebase, and an open sheet already claims it. The header
   * chevron is the affordance that asks the question.
   */
  const requestBack = useCallback(() => {
    if (status === 'ready' && dirty) setDiscardOpen(true);
    else onLeave();
  }, [dirty, onLeave, status]);

  const body =
    status === 'loading' ? (
      <ProfileFormSkeleton />
    ) : status === 'error' ? (
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    ) : status === 'missing' ? (
      <StateView
        icon="folder-open"
        title="That entry no longer exists"
        actionLabel={`Back to ${listLabel}`}
        onAction={onLeave}
      />
    ) : (
      <>
        {children}
        {remove ? (
          <RowGroup>
            <ListRow
              icon="trash-alt"
              tone="danger"
              label={remove.label}
              showChevron={false}
              onPress={() => setRemoveOpen(true)}
            />
          </RowGroup>
        ) : null}
      </>
    );

  // The bar is pinned while loading too: it owns the bottom safe-area inset, so a page without
  // one would grow a footer out of nothing the moment the profile lands.
  const footer =
    status === 'loading' ? (
      <StickyActionBar primary={{ label: 'Save', disabled: true }} />
    ) : status === 'ready' ? (
      <StickyActionBar
        note={note}
        primary={{
          label: 'Save',
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
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        footer={footer}
      >
        {body}
      </Screen>

      {/* Every sheet is a sibling of the page, never a child of its scroller. */}
      {sheets}

      <ConfirmSheet
        open={discardOpen}
        title="Discard changes?"
        message={DISCARD_MESSAGE}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onLeave();
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      {remove ? (
        <ConfirmSheet
          open={removeOpen}
          title={`${remove.label}?`}
          message={remove.message}
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
