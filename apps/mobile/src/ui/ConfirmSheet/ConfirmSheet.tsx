import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
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
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** The confirm content alone, testable without the Sheet's gestures and animation. */
export function ConfirmSheetBody({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetBodyProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingVertical: spacing[4], gap: spacing[3] }}>
      <Text {...a11yHeader(title)} variant="headline">
        {title}
      </Text>
      <Text variant="body" color="textSecondary">
        {message}
      </Text>
      <View style={[styles.actions, { gap: spacing[3], marginTop: spacing[2] }]}>
        <Button
          label={confirmLabel}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          haptic="medium"
          loading={busy}
          onPress={onConfirm}
          block
        />
        <Button label={cancelLabel} variant="ghost" onPress={onCancel} block />
      </View>
    </View>
  );
}

export type ConfirmSheetProps = ConfirmSheetBodyProps & {
  open: boolean;
};

/**
 * Destructive-action confirm (delete resume, sign out, delete account). Scrim tap, ✕-less
 * Cancel, and Android back all route through `onCancel`.
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

const styles = StyleSheet.create({
  actions: { flexDirection: 'column' },
});
