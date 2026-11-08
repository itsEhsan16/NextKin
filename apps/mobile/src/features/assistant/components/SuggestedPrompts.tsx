import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/kit';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { StarterPrompt } from '../assistantPrompts';
import { AssistantAvatar } from './MessageBubble';

/**
 * An empty chat (§188): the assistant's mark, a greeting by name, what it can help with, and four
 * questions made from what this person has. A card asks its question at once: the composer shows
 * what is left today, so nothing is spent unseen.
 */
export function AssistantWelcome({
  firstName,
  prompts,
  onAsk,
  disabled,
}: {
  firstName?: string;
  prompts: readonly StarterPrompt[];
  onAsk: (prompt: string) => void;
  disabled: boolean;
}) {
  const { colors, shadows } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <AssistantAvatar size={56} />
        <Text variant="title1" color="ink" align="center" accessibilityRole="header">
          {firstName ? `Hi ${firstName}, how can I help?` : 'How can I help?'}
        </Text>
        <Text variant="callout" color="textSecondary" align="center" style={styles.lede}>
          Ask about your resume, ATS score, job search or interviews. I advise; I never change your
          documents.
        </Text>
      </View>
      <View style={styles.list}>
        {prompts.map((item, index) => (
          <Animated.View
            key={item.prompt}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
          >
            <Pressable
              {...a11yButton(`Ask: ${item.prompt}`)}
              feedback="scale"
              disabled={disabled}
              onPress={() => onAsk(item.prompt)}
              style={[
                styles.card,
                shadows.soft,
                { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
              ]}
            >
              <IconTile name={item.icon} size={36} />
              <Text variant="bodyLgStrong" color="ink" style={styles.grow}>
                {item.prompt}
              </Text>
              <Icon name="ArrowUp" size="xs" color={colors.iconMuted} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/** The next questions under a finished answer: one tap asks. */
export function FollowUpChips({
  prompts,
  onAsk,
}: {
  prompts: readonly string[];
  onAsk: (prompt: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (prompts.length === 0) return null;
  return (
    <View style={styles.follow}>
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          {...a11yButton(`Ask: ${prompt}`)}
          feedback="subtle"
          onPress={() => onAsk(prompt)}
          style={[styles.chip, { borderColor: colors.brandBorder }]}
        >
          <Icon name="Stars02" size="xs" color={colors.brand} />
          <Text variant="footnote" color="ink" style={styles.grow}>
            {prompt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { gap: u(24), paddingTop: u(16) },
  head: { alignItems: 'center', gap: u(10) },
  lede: { maxWidth: u(320) },
  list: { gap: u(10) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(12),
    padding: u(14),
    borderRadius: u(20),
    borderWidth: 1,
  },
  grow: { flex: 1 },
  follow: { gap: u(8), paddingLeft: u(42), alignItems: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(8),
    paddingHorizontal: u(12),
    paddingVertical: u(8),
    borderRadius: u(999),
    borderWidth: 1,
    maxWidth: '100%',
  },
}));
