import { StyleSheet, View } from 'react-native';

import { ASSISTANT_DISCLAIMER } from '@/data/models';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** A turn is being sent, or a reply is still being written: one question at a time. */
  busy: boolean;
  /** The last send did not reach the assistant at all (distinct from a reply that stopped). */
  failed: boolean;
  disabled?: boolean;
};

export const ASSISTANT_MESSAGE_MAX = 500;
const SEND_FAILED = "That didn't send. Check your connection and try again.";

/**
 * The pinned composer (V2 §7.16). Rides up with the keyboard as the `Screen`'s footer, and the
 * §7.16 label — AI-generated guidance, not professional or legal advice — is part of it, so the
 * label is on screen whatever the transcript is scrolled to. There is no attach, no voice and no
 * slash command: the assistant reads and advises, and the composer offers exactly that.
 */
export function AssistantComposer({
  value,
  onChange,
  onSend,
  busy,
  failed,
  disabled = false,
}: AssistantComposerProps) {
  const { colors, spacing } = useTheme();
  const ready = value.trim().length > 0 && !busy && !disabled;

  return (
    <View
      style={[
        styles.root,
        {
          borderTopColor: colors.borderHairline,
          backgroundColor: colors.surfacePage,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[3],
          paddingBottom: spacing[3],
          gap: spacing[2],
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing[2] }]}>
        <TextField
          value={value}
          onChangeText={onChange}
          placeholder="Ask about your resume, score or job search"
          accessibilityLabel="Message"
          multiline
          minLines={1}
          maxLength={ASSISTANT_MESSAGE_MAX}
          editable={!disabled}
          style={styles.field}
        />
        <IconButton
          icon="paper-plane"
          label={busy ? 'Sending' : 'Send'}
          variant="filled"
          onPress={onSend}
          disabled={!ready}
        />
      </View>
      {failed ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {SEND_FAILED}
        </Text>
      ) : null}
      <Text variant="captionSm" color="textTertiary">
        {ASSISTANT_DISCLAIMER}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  field: { flex: 1 },
});
