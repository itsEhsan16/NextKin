import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { ASSISTANT_SUGGESTIONS } from '@/data/models';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SuggestedPromptsProps = {
  /** Fills the composer — the reader still presses send, so a mis-tap costs nothing. */
  onPick: (prompt: string) => void;
  /** The first-run layout (ASSISTANT 02 577:7828): the label and the prompts centred. */
  centred?: boolean;
};

// ASSISTANT 01 / 02 at 390 (577:6542 → 577:6544, a prompt 577:6545), in artboard units.
const LABEL_TO_PROMPTS = 10;
const GAP_X = 7;
const GAP_Y = 8;
const PAD_LEFT = 12;
const PAD_RIGHT = 14;
const PAD_Y = 8;
const PROMPT_GAP = 7;
const SPARKLE_W = 13;
const SPARKLE_H = 12.734;
/** One line of prompt: 8 + 17 + 8. Its target reaches 44 through slop. */
const PROMPT_H = 33;

/**
 * §7.16's suggested prompts, offered whenever the composer is empty. Picking one fills the field
 * rather than sending: the cap is per message, and the reader should see what they are about to
 * spend one on.
 */
export function SuggestedPrompts({ onPick, centred = false }: SuggestedPromptsProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text
        variant="captionSemiBold"
        accessibilityRole="header"
        align={centred ? 'center' : 'left'}
      >
        Try asking
      </Text>
      <View style={[styles.prompts, centred ? styles.centred : null]}>
        {ASSISTANT_SUGGESTIONS.map((prompt) => (
          <Pressable
            key={prompt}
            {...a11yButton(`Ask: ${prompt}`, 'Puts the question in the message field')}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlopFor(s(PROMPT_H / 0.75))}
            onPress={() => onPick(prompt)}
            style={[
              styles.prompt,
              {
                borderRadius: radii.full,
                borderWidth: s(1 / 0.75),
                borderColor: colors.borderDefault,
                backgroundColor: colors.surfaceCard,
              },
            ]}
          >
            <SparkleIcon width={s(SPARKLE_W / 0.75)} height={s(SPARKLE_H / 0.75)} />
            <Text variant="caption" color="textBody" style={styles.label}>
              {prompt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(GAP_X / 0.75),
    rowGap: s(GAP_Y / 0.75),
    marginTop: s(LABEL_TO_PROMPTS / 0.75),
  },
  centred: { justifyContent: 'center' },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PROMPT_GAP / 0.75),
    paddingLeft: s(PAD_LEFT / 0.75),
    paddingRight: s(PAD_RIGHT / 0.75),
    paddingVertical: s(PAD_Y / 0.75),
  },
  label: { flexShrink: 1 },
}));
