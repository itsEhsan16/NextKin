import { View } from 'react-native';

import {
  COVER_LETTER_TONE_HINT,
  COVER_LETTER_TONE_LABEL,
  type CoverLetterTone,
} from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { COVER_LETTER_TONES } from '../coverLetterSetup';

export type CoverLetterTonePickerProps = {
  value: CoverLetterTone;
  onChange: (tone: CoverLetterTone) => void;
};

// COVER 01 at 390 (644:53 → 644:74), in artboard units.
const HEADING_TO_ROWS = 10 / 0.75; // 644:55
const ROW_GAP = 8 / 0.75; // 644:61
const ROW_PAD_X = 14 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP_X = 12 / 0.75;
const ROW_RADIUS = 13 / 0.75;
const LINE_GAP = 1 / 0.75;
/** The radio (644:57 / 644:63): a 20 disc, a 6 brand ring round a white 8 dot when picked. */
const RADIO = 20 / 0.75;
const RADIO_DOT = 8 / 0.75;
const RADIO_RING = 1.5 / 0.75;

function Radio({ on }: { on: boolean }) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.radio,
        { borderRadius: radii.full },
        on
          ? { backgroundColor: colors.brand }
          : [styles.ring, { backgroundColor: colors.surfaceCard, borderColor: colors.iconChevron }],
      ]}
    >
      {on ? (
        <View
          style={[styles.dot, { borderRadius: radii.full, backgroundColor: colors.textOnBrand }]}
        />
      ) : null}
    </View>
  );
}

/**
 * COVER 01's tone list (644:53–644:78): "Tone", then the four §7.10 tones as cards, each with
 * the line that says what it sounds like. The picked card washes lavender with a filled radio;
 * the rest stay white on the page's card shadow. The cards are radios in a radiogroup, so a
 * screen reader hears that the four are mutually exclusive and gets each hint read with it.
 */
export function CoverLetterTonePicker({ value, onChange }: CoverLetterTonePickerProps) {
  const { colors, shadows, sizes } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text variant="title" {...a11yHeader('Tone')}>
        Tone
      </Text>
      <View accessibilityRole="radiogroup" style={styles.rows}>
        {COVER_LETTER_TONES.map((tone) => {
          const selected = tone === value;
          const label = COVER_LETTER_TONE_LABEL[tone];
          return (
            <Pressable
              key={tone}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityHint={COVER_LETTER_TONE_HINT[tone]}
              accessibilityState={{ selected }}
              feedback="subtle"
              haptic="selection"
              onPress={() => onChange(tone)}
              style={[
                styles.row,
                { borderWidth: sizes.border },
                selected
                  ? { backgroundColor: colors.brandSurface, borderColor: colors.brandBorder }
                  : [
                      shadows.card,
                      { backgroundColor: colors.surfaceCard, borderColor: colors.borderHairline },
                    ],
              ]}
            >
              <Radio on={selected} />
              <View style={styles.text}>
                <Text variant={selected ? 'label' : 'menuRow'}>{label}</Text>
                <Text variant="caption" color="textSecondary">
                  {COVER_LETTER_TONE_HINT[tone]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  rows: { marginTop: s(HEADING_TO_ROWS), gap: s(ROW_GAP) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP_X),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
    borderRadius: s(ROW_RADIUS),
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  radio: { width: s(RADIO), height: s(RADIO), alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: s(RADIO_RING) },
  dot: { width: s(RADIO_DOT), height: s(RADIO_DOT) },
}));
