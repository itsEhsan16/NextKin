import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import type { AssistantMessage } from '@/data/models';
import { useAssistantReply } from '@/data/queries';
import { a11yButton, copyToClipboard, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { StatusPill } from '@/ui/kit';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { showAppToast } from '@/ui/Toast';
import { TypingDots } from '@/ui/motion';

import { plainText } from '../assistantPrompts';
import { RichText } from './RichText';

export type MessageBubbleProps = {
  message: AssistantMessage;
  /** Re-sends the user turn this reply answered. Only offered on a reply that failed mid-way. */
  onRetry?: () => void;
  /** The resume this answer was written against, named under it so the reader knows. */
  contextTitle?: string;
  /**
   * Arrive rather than appear: a sent turn slides in from its side, a reply's first words rise.
   * Only for a turn new on screen; a settled reply swapping in for its streaming copy must not.
   */
  enter?: boolean;
};

const sentIn = FadeInRight.duration(motion.durations.base);
const replyIn = FadeInDown.duration(motion.durations.base);
const statusIn = FadeIn.duration(motion.durations.fast);

const STOPPED_LINE = 'That answer stopped part-way.';

/** The assistant's mark: the sparkle on a brand disc. Decorative; the row says who spoke. */
export function AssistantAvatar({ size = 30 }: { size?: number }) {
  const { colors, u } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: u(size),
        height: u(size),
        borderRadius: u(size) / 2,
        backgroundColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="Stars02" size={u(size * 0.55)} color={colors.textOnBrand} />
    </View>
  );
}

/**
 * One turn (V2 §7.16, redesigned §188). Yours sits right on the brand fill; the assistant's reads
 * as text on the page beside its mark, with bold and lists drawn properly, the resume it used
 * named under it, and Copy. A refusal is the same voice with an "Out of scope" pill, never a red
 * error. `memo` over an immutable message: while a reply streams only its own leaf re-renders.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  onRetry,
  contextTitle,
  enter = false,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const animate = enter && !reduced;
  const user = message.role === 'user';
  const refusal = message.refusal != null;
  const failed = message.status === 'failed';
  const done = message.status === 'complete' && !refusal && message.text.length > 0;

  const label = `${user ? 'You' : 'Assistant'}${refusal ? ', out of scope' : ''}: ${plainText(message.text)}${failed ? ` ${STOPPED_LINE}` : ''}`;

  if (user) {
    return (
      <Animated.View
        entering={animate ? sentIn : undefined}
        style={styles.userRow}
        accessibilityRole="text"
        accessibilityLabel={label}
      >
        <View style={[styles.userBubble, { backgroundColor: colors.brand }]}>
          <Text variant="bodyLg" color="textOnBrand">
            {message.text}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const copy = async () => {
    const result = await copyToClipboard(plainText(message.text));
    showAppToast(result === 'done' ? 'Answer copied' : 'Couldn’t copy on this device');
  };

  return (
    <Animated.View entering={animate ? replyIn : undefined} style={styles.replyRow}>
      <AssistantAvatar />
      <View style={styles.reply}>
        <View accessible accessibilityRole="text" accessibilityLabel={label} style={styles.body}>
          {refusal ? <StatusPill label="Out of scope" tone="neutral" icon="SlashCircle01" /> : null}
          {message.text.length > 0 ? <RichText text={message.text} /> : null}
        </View>
        {failed ? (
          <View style={styles.failed}>
            <Text variant="footnote" color="textSecondary">
              {STOPPED_LINE}
            </Text>
            {onRetry ? (
              <Button
                label="Try again"
                variant="outline"
                size="md"
                icon="RefreshCw01"
                onPress={onRetry}
              />
            ) : null}
          </View>
        ) : null}
        {done ? (
          <View style={styles.meta}>
            <Pressable
              {...a11yButton('Copy answer')}
              feedback="subtle"
              onPress={() => void copy()}
              style={[styles.copy, { borderColor: colors.borderSoft }]}
            >
              <Icon name="Clipboard" size="xs" color={colors.textSecondary} />
              <Text variant="footnote" color="textSecondary">
                Copy
              </Text>
            </Pressable>
            {contextTitle ? (
              <View style={styles.source}>
                <Icon name="File04" size="xs" color={colors.iconMuted} />
                <Text variant="footnote" color="textTertiary" numberOfLines={1} style={styles.grow}>
                  {`Used ${contextTitle}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

export type StreamingBubbleProps = {
  messageId: string;
  onRetry?: () => void;
  contextTitle?: string;
};

/**
 * The one reply in flight. The sole subscriber to `useAssistantReply`, so a token re-renders this
 * leaf and nothing else; once it settles the screen swaps it for a plain `MessageBubble`.
 */
export function StreamingBubble({ messageId, onRetry, contextTitle }: StreamingBubbleProps) {
  const { u } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const reply = useAssistantReply(messageId);
  const message = reply.data;

  if (!message) return null;
  if (message.status !== 'streaming')
    return <MessageBubble message={message} onRetry={onRetry} contextTitle={contextTitle} />;

  if (message.text.length > 0) {
    return (
      <View accessibilityLiveRegion="polite">
        <MessageBubble message={message} enter />
        <View style={[styles.status, styles.writing]}>
          <TypingDots size={u(5)} />
          <Text variant="footnote" color="textTertiary">
            Writing…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      entering={reduced ? undefined : statusIn}
      accessibilityLiveRegion="polite"
      style={styles.replyRow}
    >
      <AssistantAvatar />
      <View style={[styles.status, styles.thinking]}>
        <TypingDots size={u(5)} />
        <Text variant="footnote" color="textTertiary">
          {contextTitle ? `Reading ${contextTitle}…` : 'Thinking…'}
        </Text>
      </View>
    </Animated.View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: u(48) },
  userBubble: {
    paddingHorizontal: u(16),
    paddingVertical: u(11),
    borderTopLeftRadius: u(22),
    borderTopRightRadius: u(22),
    borderBottomLeftRadius: u(22),
    borderBottomRightRadius: u(6),
  },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: u(12) },
  reply: { flex: 1, gap: u(10), paddingTop: u(4) },
  body: { gap: u(8), alignItems: 'flex-start' },
  failed: { gap: u(8), alignItems: 'flex-start' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    paddingHorizontal: u(10),
    paddingVertical: u(5),
    borderRadius: u(999),
    borderWidth: 1,
  },
  source: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(6) },
  grow: { flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  thinking: { minHeight: u(30) },
  writing: { marginTop: u(8), marginLeft: u(42) },
}));
