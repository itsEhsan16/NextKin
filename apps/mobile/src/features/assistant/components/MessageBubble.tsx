import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import AvatarMark from '../../../../assets/icons/assistant/ai-avatar.svg';
import type { AssistantMessage } from '@/data/models';
import { useAssistantReply } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Text } from '@/ui/Text';
import { TypingDots } from '@/ui/motion';

export type MessageBubbleProps = {
  message: AssistantMessage;
  /** Re-sends the user turn this reply answered. Only offered on a reply that failed mid-way. */
  onRetry?: () => void;
  /**
   * Arrive rather than appear: a sent turn slides in from its side, a reply's first words rise.
   * Only for a turn that is new on screen - a settled reply swapping in for its streaming copy
   * must not fade in a second time.
   */
  enter?: boolean;
};

const sentIn = FadeInRight.duration(motion.durations.base);
const replyIn = FadeInDown.duration(motion.durations.base);
const statusIn = FadeIn.duration(motion.durations.fast);

const STOPPED_LINE = 'That answer stopped part-way.';
const DOT = 5;

// ASSISTANT 01 at 390 (577:6505 user, 577:6509 reply, 577:6526 refusal), in artboard units.
const RADIUS = 18;
const TUCK = 6; // the corner nearest the speaker
const USER_PAD_Y = 11;
const REPLY_PAD_Y = 12;
const PAD_X = 14;
const REFUSAL_GAP = 8;
const AVATAR = 32;
const AVATAR_RADIUS = 8.205;
const AVATAR_MARK_W = 24.64;
const AVATAR_MARK_H = 16.761;
const AVATAR_GAP = 8;
/** 266 of text plus the bubble's padding, of the 354 the page gives a row. */
const MAX_WIDTH = '83%';

/** The assistant's mark on its lavender tile (577:6510). Decorative: the bubble says who spoke. */
export function AssistantAvatar() {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: colors.tileBrandStrong }]}
    >
      <AvatarMark width={s(AVATAR_MARK_W / 0.75)} height={s(AVATAR_MARK_H / 0.75)} />
    </View>
  );
}

/**
 * One turn of the conversation (V2 §7.16, ASSISTANT 01). `memo` over an immutable message: while
 * a reply streams, only `StreamingBubble` below re-renders — every settled bubble keeps its props
 * and is skipped, which is what keeps the list still under a growing answer.
 *
 * A refusal is the assistant's voice in a quieter grey surface with an "Out of scope" pill, never
 * a red error: the message says what the assistant can help with, and the rendering does not make
 * the reader feel told off.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  onRetry,
  enter = false,
}: MessageBubbleProps) {
  const { colors, shadows, sizes } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const animate = enter && !reduced;
  const user = message.role === 'user';
  const refusal = message.refusal != null;
  const failed = message.status === 'failed';

  const label = `${user ? 'You' : 'Assistant'}${refusal ? ', out of scope' : ''}: ${message.text}${failed ? ` ${STOPPED_LINE}` : ''}`;

  if (user) {
    return (
      <Animated.View
        entering={animate ? sentIn : undefined}
        style={styles.userRow}
        accessibilityRole="text"
        accessibilityLabel={label}
      >
        <View
          style={[styles.bubble, styles.userBubble, { backgroundColor: colors.surfaceInverse }]}
        >
          <Text variant="body" color="textOnDark">
            {message.text}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={animate ? replyIn : undefined}
      style={styles.replyRow}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <AssistantAvatar />
      <View
        style={[
          styles.bubble,
          styles.replyBubble,
          refusal ? null : shadows.jobCard,
          {
            backgroundColor: refusal ? colors.surfaceSubtle : colors.surfaceCard,
            borderWidth: sizes.border,
            borderColor: colors.borderHairline,
          },
        ]}
      >
        {refusal ? <Pill label="Out of scope" tone="plain" icon="ban" /> : null}
        {message.text.length > 0 ? (
          <Text variant="body" color="textBody">
            {message.text}
          </Text>
        ) : null}
        {failed ? (
          <View style={styles.failed}>
            <Text variant="caption" color="textSecondary">
              {STOPPED_LINE}
            </Text>
            {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

export type StreamingBubbleProps = { messageId: string; onRetry?: () => void };

/**
 * The one reply in flight. The sole subscriber to `useAssistantReply`, so a token re-renders
 * this leaf and nothing else; when the reply settles the hook writes it into the list once and
 * the screen swaps this for a plain `MessageBubble`.
 */
export function StreamingBubble({ messageId, onRetry }: StreamingBubbleProps) {
  const { s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const reply = useAssistantReply(messageId);
  const message = reply.data;

  if (!message) return null;
  if (message.status !== 'streaming') return <MessageBubble message={message} onRetry={onRetry} />;

  return (
    <Animated.View
      entering={reduced ? undefined : statusIn}
      accessibilityLiveRegion="polite"
      style={styles.streaming}
    >
      {message.text.length > 0 ? <MessageBubble message={message} enter /> : null}
      <View style={styles.replyRow}>
        {message.text.length === 0 ? <AssistantAvatar /> : <View style={styles.avatarSlot} />}
        {/* The dots say "composing" at a glance; the words stay for anyone reading closely. */}
        <View style={[styles.status, styles.statusRow]}>
          <TypingDots size={s(DOT)} />
          <Text variant="micro" color="textTertiary">
            {message.text.length === 0 ? 'Thinking…' : 'Writing…'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(AVATAR_GAP / 0.75) },
  bubble: { maxWidth: MAX_WIDTH, paddingHorizontal: s(PAD_X / 0.75) },
  userBubble: {
    paddingVertical: s(USER_PAD_Y / 0.75),
    borderTopLeftRadius: s(RADIUS / 0.75),
    borderTopRightRadius: s(RADIUS / 0.75),
    borderBottomLeftRadius: s(RADIUS / 0.75),
    borderBottomRightRadius: s(TUCK / 0.75),
  },
  replyBubble: {
    paddingVertical: s(REPLY_PAD_Y / 0.75),
    gap: s(REFUSAL_GAP / 0.75),
    borderTopLeftRadius: s(TUCK / 0.75),
    borderTopRightRadius: s(RADIUS / 0.75),
    borderBottomLeftRadius: s(RADIUS / 0.75),
    borderBottomRightRadius: s(RADIUS / 0.75),
  },
  avatar: {
    width: s(AVATAR / 0.75),
    height: s(AVATAR / 0.75),
    borderRadius: s(AVATAR_RADIUS / 0.75),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSlot: { width: s(AVATAR / 0.75) },
  failed: { gap: s(8 / 0.75) },
  streaming: { gap: s(6 / 0.75) },
  status: { alignSelf: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: s(6 / 0.75) },
}));
