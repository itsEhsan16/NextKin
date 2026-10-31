import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { layoutTransition } from '@/ui/motion';

import { removeAt, replaceAt, type LetterDraft } from '../../sectionEdits';
import type { SectionFieldsProps } from './types';

/**
 * V2 §7.10 — hand editing a cover letter. The tone picker and the regenerate action belong to the
 * document screen; this page is the body itself: an opening line, the paragraphs, a sign-off.
 */
export function LetterEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<LetterDraft>) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const layout = layoutTransition(reduced);

  const setParagraphs = (paragraphs: string[]) => onChange({ ...value, paragraphs });

  return (
    <View style={{ gap: spacing[5] }}>
      <TextField
        label="Greeting"
        accessibilityLabel="Greeting"
        placeholder="Dear Hiring Manager,"
        value={value.greeting}
        onChangeText={(greeting) => onChange({ ...value, greeting })}
        onBlur={() => onBlurField?.('greeting')}
        error={errors.greeting}
      />

      <View style={{ gap: spacing[3] }}>
        <Text variant="groupLabel">Paragraphs</Text>

        {value.paragraphs.map((paragraph, index) => (
          <Animated.View
            // Index-keyed on purpose: a paragraph has no id, and its position in the letter is
            // its identity — removing the second one must shuffle the third up, not re-mount all.
            key={`paragraph-${index}`}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            style={[styles.row, { gap: spacing[2] }]}
          >
            <TextField
              value={paragraph}
              onChangeText={(text) => setParagraphs(replaceAt(value.paragraphs, index, text))}
              onBlur={() => onBlurField?.('paragraphs')}
              accessibilityLabel={`Paragraph ${index + 1}`}
              placeholder="What you would bring, and the evidence for it."
              multiline
              minLines={4}
              style={styles.field}
            />
            <IconButton
              icon="XClose"
              variant="ghost"
              label={`Remove paragraph ${index + 1}`}
              onPress={() => setParagraphs(removeAt(value.paragraphs, index))}
            />
          </Animated.View>
        ))}

        {errors.paragraphs ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {errors.paragraphs}
          </Text>
        ) : null}

        <Button
          label="Add paragraph"
          variant="ghost"
          icon="Plus"
          onPress={() => setParagraphs([...value.paragraphs, ''])}
        />
      </View>

      <TextField
        label="Sign-off"
        accessibilityLabel="Sign-off"
        placeholder="Sincerely, George"
        value={value.signoff}
        onChangeText={(signoff) => onChange({ ...value, signoff })}
        onBlur={() => onBlurField?.('signoff')}
        error={errors.signoff}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  field: { flex: 1 },
});
