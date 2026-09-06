import { StyleSheet, View } from 'react-native';

import { ASSISTANT_SCOPE_LINE, ASSISTANT_SUGGESTIONS } from '@/data/models';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

export type SuggestedPromptsProps = {
  /** Fills the composer — the reader still presses send, so a mis-tap costs nothing. */
  onPick: (prompt: string) => void;
  /** The blank-thread treatment: the scope line above the chips. */
  intro?: boolean;
};

/**
 * §7.16's first-use suggested prompts, offered whenever the composer is empty. Picking one
 * fills the field rather than sending: the cap is per message, and the reader should see what
 * they are about to spend one on.
 */
export function SuggestedPrompts({ onPick, intro = false }: SuggestedPromptsProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[3] }}>
      {intro ? (
        <Text variant="body" color="textSecondary">
          {ASSISTANT_SCOPE_LINE}
        </Text>
      ) : null}
      <Text variant="groupLabel">Try asking</Text>
      <View style={[styles.chips, { gap: spacing[2] }]}>
        {ASSISTANT_SUGGESTIONS.map((prompt) => (
          <FilterChip
            key={prompt}
            label={prompt}
            variant="select"
            selected={false}
            onPress={() => onPick(prompt)}
            accessibilityLabel={`Ask: ${prompt}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
