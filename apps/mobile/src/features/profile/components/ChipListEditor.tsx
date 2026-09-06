import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { discardMessage, DISCARD_TITLE, SAVE_FAILED } from '../chipEdits';
import { ChipListBody, ChipListSkeleton, type ChipListBodyProps } from './ChipListParts';

export type ChipListEditorProps = ChipListBodyProps & {
  title: string;
  /** Rendered under the editor — Locations puts its remote chooser here. */
  below?: ReactNode;
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

/**
 * The page all three §7.3 chip screens are: a header, the editable list, an optional extra
 * section under it, and a Save bar that stays inert until something has actually changed. No
 * artboard draws any of them (plan §8), so it is assembled from the built primitives alone.
 *
 * The draft lives in the screen above rather than here, because a screen can hold more than the
 * list — Locations edits a remote preference in the same save — and `dirty` has to account for
 * all of it before Save goes live.
 */
export function ChipListEditor({
  title,
  below,
  loading,
  error,
  onRetry,
  dirty,
  saving,
  failed,
  onSave,
  onClose,
  ...body
}: ChipListEditorProps) {
  const { spacing } = useTheme();
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
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* A sibling of the page, never a child of its scroller. */}
      <ConfirmSheet
        open={confirmOpen}
        title={DISCARD_TITLE}
        message={discardMessage(body.noun)}
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
      <ChipListSkeleton />,
      <StickyActionBar primary={{ label: 'Save', disabled: true }} />,
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

  return page(
    <>
      <ChipListBody {...body} />
      {below}
    </>,
    <StickyActionBar
      note={failed ? SAVE_FAILED : undefined}
      primary={{
        label: 'Save',
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
