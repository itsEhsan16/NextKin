import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EDITABLE_SECTION_LABEL, type CoverLetterContent } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

export type LetterBodyProps = {
  content: CoverLetterContent;
  onEdit: () => void;
};

const ACTION = 36;
const ACTION_GLYPH = 13;

/**
 * A cover letter's body (V2 §7.10): greeting, paragraphs and signoff in one card, edited as one
 * piece. A letter has no §7.11 sections, so the six resume cards are not drawn for it.
 *
 * There is deliberately NO tone picker here. Rewriting a letter in another tone spends a
 * cover-letter generation, and §13.5 requires the remaining allowance to be on screen BEFORE the
 * work starts — that banner belongs to the cover-letter flow (plan Phase 9D), which owns the
 * quota and the upgrade prompt. Offering the tones from this card would spend the allowance with
 * no cap in sight. The tone is shown read-only on the meta strip until that flow lands.
 */
export function LetterBody({ content, onEdit }: LetterBodyProps) {
  const { motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const label = EDITABLE_SECTION_LABEL.letter;

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(motion.durations.base)}>
      <Card radius="card" padding={spacing[5]} style={{ gap: spacing[4] }}>
        <View style={styles.header}>
          <Text variant="label" accessibilityRole="header" style={styles.fill}>
            {label}
          </Text>
          <IconButton
            icon="pen"
            label={`Edit ${label.toLowerCase()}`}
            variant="ghost"
            size={s(ACTION)}
            iconSize={s(ACTION_GLYPH)}
            iconColor="iconDefault"
            onPress={onEdit}
          />
        </View>

        <View style={{ gap: spacing[4] }}>
          <Text variant="prose" color="textBody">
            {content.greeting}
          </Text>
          {content.paragraphs.map((paragraph) => (
            <Text key={paragraph} variant="prose" color="textBody">
              {paragraph}
            </Text>
          ))}
          <Text variant="prose" color="textBody">
            {content.signoff}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
