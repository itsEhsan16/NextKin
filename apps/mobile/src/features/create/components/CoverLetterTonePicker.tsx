import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import {
  COVER_LETTER_TONE_HINT,
  COVER_LETTER_TONE_LABEL,
  type CoverLetterTone,
} from '@/data/models';
import { hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { COVER_LETTER_TONES } from '../coverLetterSetup';

export type CoverLetterTonePickerProps = {
  value: CoverLetterTone;
  onChange: (tone: CoverLetterTone) => void;
};

/** Grouped-row metrics, matching ListRow so these rows line up with every other carded row. */
const ROW_PADDING = 20;
const CHECK = 14;

/**
 * The four §7.10 tones, one row each, with the model's own one-line hint under every label.
 *
 * Rows rather than a chip strip: this is a single-choice group, so it takes the radiogroup / radio
 * semantics `OptionSheetBody` uses for the same question — `FilterChip` reads as a button with a
 * selected state, which tells a screen reader nothing about the four being mutually exclusive.
 * The hints decide it too: a chip is one line of text, and dropping them would leave the reader
 * choosing a tone by its adjective alone.
 */
export function CoverLetterTonePicker({ value, onChange }: CoverLetterTonePickerProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">Tone</Text>
      <Card radius="card" padding={0}>
        <View accessibilityRole="radiogroup" style={{ paddingVertical: spacing[2] }}>
          {COVER_LETTER_TONES.map((tone) => {
            const selected = tone === value;
            return (
              <Pressable
                key={tone}
                accessible
                accessibilityRole="radio"
                accessibilityLabel={COVER_LETTER_TONE_LABEL[tone]}
                accessibilityHint={COVER_LETTER_TONE_HINT[tone]}
                accessibilityState={{ selected }}
                feedback="subtle"
                haptic="selection"
                hitSlop={hitSlop8}
                onPress={() => onChange(tone)}
                style={[
                  styles.row,
                  {
                    minHeight: sizes.listRow,
                    paddingHorizontal: s(ROW_PADDING),
                    paddingVertical: spacing[2],
                    gap: spacing[3],
                  },
                ]}
              >
                <View style={styles.labels}>
                  <Text variant="rowTitle" numberOfLines={1}>
                    {COVER_LETTER_TONE_LABEL[tone]}
                  </Text>
                  <Text variant="rowDescription" color="textSecondary">
                    {COVER_LETTER_TONE_HINT[tone]}
                  </Text>
                </View>
                {selected ? (
                  <FontAwesome5 name="check" size={s(CHECK)} color={colors.textPrimary} solid />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  labels: { flex: 1, gap: s(2) },
}));
