import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { StarterPrompt } from '../assistantPrompts';

/**
 * An empty chat (§188, §198, §212: no mark above it, owner): a greeting by name, what it helps with, and
 * "Try asking": four questions made from what this person has, as centred chips. One tap asks.
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
  const { colors } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="title1" color="ink" align="center" accessibilityRole="header">
          {firstName ? `Hi ${firstName}, how can I help?` : 'How can I help?'}
        </Text>
        <Text variant="callout" color="textSecondary" align="center" style={styles.lede}>
          Get clear, practical advice on your resume, ATS score, job search, interview prep and
          more.
        </Text>
      </View>
      {/* "Try asking" as centred chips, one tap asks (owner's reference, §198). */}
      <View style={styles.tryBlock}>
        <Text variant="bodyLgStrong" color="ink" align="center" accessibilityRole="header">
          Try asking
        </Text>
        <View style={styles.chips}>
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
              // The wrapper is what the row wraps, so it too stops at the screen's width.
              style={styles.chipWrap}
            >
              <Pressable
                {...a11yButton(`Ask: ${item.prompt}`)}
                feedback="scale"
                disabled={disabled}
                onPress={() => onAsk(item.prompt)}
                style={[
                  styles.tryChip,
                  { backgroundColor: colors.surfaceCard, borderColor: colors.borderDefault },
                ]}
              >
                <Icon name="Stars02" size="sm" color={colors.brand} />
                <Text variant="callout" color="textBody" style={styles.chipText}>
                  {item.prompt}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
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
          <Icon name="Stars02" size="sm" color={colors.brand} />
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
  tryBlock: { gap: u(12) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(8) },
  tryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(8),
    paddingHorizontal: u(14),
    paddingVertical: u(9),
    borderRadius: u(999),
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipWrap: { maxWidth: '100%' },
  chipText: { flexShrink: 1 },
  grow: { flexShrink: 1 },
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
