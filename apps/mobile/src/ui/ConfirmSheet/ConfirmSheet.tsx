import type { ReactNode } from 'react';
import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export type ConfirmSheetBodyProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger paints the confirm in the destructive style; both fire a medium haptic. */
  tone?: 'danger' | 'neutral';
  /**
   * Centred above the title: the action's own icon in a red tint (PROFILE 22 577:2330, PROFILE
   * 24 577:3383) or an illustration. Without one the title leads.
   */
  art?: ReactNode;
  /** Art → title in device px, where a board draws other than PROFILE 22's 14 (BILLING 02: 2). */
  artGap?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// PROFILE 21–24 at 390 (573:820), in artboard units.
const TOP = 16 / 0.75; // handle → art: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const ART_TO_TITLE = 14 / 0.75;
const TITLE_TO_MESSAGE = 8 / 0.75;
const MESSAGE_TO_ACTIONS = 22 / 0.75;
const BUTTON_GAP = 10 / 0.75;

/** The confirm content alone, testable without the Sheet's gestures and animation. */
export function ConfirmSheetBody({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  art,
  artGap,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetBodyProps) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.body, { paddingHorizontal: spacing.gutter }]}>
      <View style={styles.copy}>
        {art ? (
          <View style={[styles.art, artGap != null ? { marginBottom: artGap } : null]}>{art}</View>
        ) : null}
        <Text {...a11yHeader(title)} variant="confirmTitle" align="center">
          {title}
        </Text>
        <Text variant="captionRegular" color="textSecondary" align="center" style={styles.message}>
          {message}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          size="lg"
          haptic="medium"
          loading={busy}
          onPress={onConfirm}
          block
        />
        <Button label={cancelLabel} variant="ghost" size="lg" onPress={onCancel} block />
      </View>
    </View>
  );
}

export type ConfirmSheetProps = ConfirmSheetBodyProps & {
  open: boolean;
};

/**
 * Destructive-action confirm (delete resume, sign out, delete account), drawn as PROFILE 21–24:
 * centred art, title and message over a soft-red confirm and an outlined Cancel. Scrim tap,
 * ✕-less Cancel, and Android back all route through `onCancel`.
 */
export function ConfirmSheet({ open, ...body }: ConfirmSheetProps) {
  const { sizes } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onCancel}
      height={sizes.sheetPickerHeight}
      accessibilityLabel={body.title}
    >
      <ConfirmSheetBody {...body} />
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  copy: { alignItems: 'center' },
  art: { marginBottom: s(ART_TO_TITLE) },
  message: { marginTop: s(TITLE_TO_MESSAGE) },
  actions: { marginTop: s(MESSAGE_TO_ACTIONS), gap: s(BUTTON_GAP) },
}));
