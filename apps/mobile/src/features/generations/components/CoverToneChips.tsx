import { View } from 'react-native';

import { COVER_LETTER_TONE_LABEL, type CoverLetterTone } from '@/data/models';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type CoverToneChipsProps = {
  /** The tones this draft is not in. */
  tones: readonly CoverLetterTone[];
  onPick: (tone: CoverLetterTone) => void;
  /** A run is starting, or the plan has not loaded yet. */
  disabled?: boolean;
  /** §13.5: the allowance is spent, so a button opens the plans rather than writing. */
  spent?: boolean;
};

// COVER 03 at 390 (644:194 → 644:203), in artboard units.
const HEADING_TO_TONES = 10 / 0.75; // 644:196
const TONE_GAP = 8 / 0.75;
const TONE_H = 40 / 0.75;
const TONE_RADIUS = 13.5 / 0.75;
/** The board's 12 leaves "Conversational" 9 a side; this keeps a word that long on one line. */
const TONE_PAD_X = 6 / 0.75;
/** A narrow phone may shrink a long tone a little rather than wrap it. */
const MIN_LABEL_SCALE = 0.85;

/**
 * "Try another tone" (644:194): one outlined button per other tone, sharing the row equally. A
 * new tone is a new draft, written in place of this screen; the draft on screen stays in
 * Resumes, which the accessibility hint says since the board has no room to.
 */
export function CoverToneChips({ tones, onPick, disabled, spent }: CoverToneChipsProps) {
  const { colors, opacity, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text {...a11yHeader()} variant="title">
        Try another tone
      </Text>
      <View style={styles.row}>
        {tones.map((tone) => {
          const label = COVER_LETTER_TONE_LABEL[tone];
          return (
            <Pressable
              key={tone}
              {...a11yButton(
                `Write it in a ${label.toLowerCase()} tone`,
                spent
                  ? 'No cover letters left this month. Opens the plans'
                  : 'Writes a new draft and keeps this one',
              )}
              accessibilityState={{ disabled: !!disabled }}
              disabled={disabled}
              feedback="scale"
              haptic="light"
              hitSlop={hitSlopFor(s(TONE_H))}
              onPress={() => onPick(tone)}
              style={[
                styles.tone,
                {
                  borderWidth: sizes.border,
                  backgroundColor: colors.surfaceCard,
                  borderColor: colors.borderDefault,
                },
                disabled ? { opacity: opacity.disabled } : null,
              ]}
            >
              <Text
                variant="captionSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={MIN_LABEL_SCALE}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { marginTop: s(HEADING_TO_TONES), flexDirection: 'row', gap: s(TONE_GAP) },
  tone: {
    flex: 1,
    height: s(TONE_H),
    paddingHorizontal: s(TONE_PAD_X),
    borderRadius: s(TONE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
