import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AssistantMessage } from '@/data/models';
import { useAssistantReply } from '@/data/queries';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

export type MessageBubbleProps = {
  message: AssistantMessage;
  /** Re-sends the user turn this reply answered. Only offered on a reply that failed mid-way. */
  onRetry?: () => void;
};

/** A bubble never spans the whole width, so the two sides read as two voices. */
const MAX_WIDTH = '86%';
const STOPPED_LINE = 'That answer stopped part-way.';

/**
 * One turn of the conversation (V2 §7.16). `memo` over an immutable message: while a reply
 * streams, only `StreamingBubble` below re-renders — every settled bubble keeps its props and is
 * skipped, which is what keeps the list still under a growing answer.
 *
 * A refusal is the assistant's voice in a quieter surface, never a red error: the message says
 * what the assistant can help with, and the rendering does not make the reader feel told off.
 */
export const MessageBubble = memo(function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const { colors, radii, spacing } = useTheme();
  const user = message.role === 'user';
  const refusal = message.refusal != null;
  const failed = message.status === 'failed';

  return (
    <View
      style={[styles.row, { justifyContent: user ? 'flex-end' : 'flex-start' }]}
      accessibilityRole="text"
      accessibilityLabel={`${user ? 'You' : 'Assistant'}${refusal ? ', out of scope' : ''}: ${message.text}${failed ? ` ${STOPPED_LINE}` : ''}`}
    >
      <View
        style={[
          styles.bubble,
          {
            maxWidth: MAX_WIDTH,
            borderRadius: radii.card,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[2],
            backgroundColor: user
              ? colors.surfaceInverse
              : refusal
                ? colors.surfaceSubtle
                : colors.surfaceCard,
            borderWidth: user ? 0 : StyleSheet.hairlineWidth,
            borderColor: colors.borderHairline,
          },
        ]}
      >
        {refusal ? (
          <Text variant="captionSm" color="textTertiary">
            Out of scope
          </Text>
        ) : null}
        {message.text.length > 0 ? (
          <Text variant="prose" color={user ? 'textOnDark' : 'textBody'}>
            {message.text}
          </Text>
        ) : null}
        {failed ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="caption" color="textSecondary">
              {STOPPED_LINE}
            </Text>
            {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export type StreamingBubbleProps = { messageId: string; onRetry?: () => void };

/**
 * The one reply in flight. The sole subscriber to `useAssistantReply`, so a token re-renders
 * this leaf and nothing else; when the reply settles the hook writes it into the list once and
 * the screen swaps this for a plain `MessageBubble`.
 */
export function StreamingBubble({ messageId, onRetry }: StreamingBubbleProps) {
  const { spacing } = useTheme();
  const reply = useAssistantReply(messageId);
  const message = reply.data;

  if (!message) return null;
  if (message.status !== 'streaming') return <MessageBubble message={message} onRetry={onRetry} />;

  return (
    <View accessibilityLiveRegion="polite" style={{ gap: spacing[1] }}>
      <MessageBubble message={message} />
      <Text variant="captionSm" color="textTertiary">
        {message.text.length === 0 ? 'Thinking…' : 'Writing…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  bubble: { alignSelf: 'flex-start' },
});
