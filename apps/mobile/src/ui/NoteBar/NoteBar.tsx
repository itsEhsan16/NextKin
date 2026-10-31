import { View, type StyleProp, type ViewStyle } from 'react-native';

import SparkleIcon from '../../../assets/icons/ai-sparkle-trio.svg';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

export type NoteBarProps = {
  text: string;
  /**
   * The AI sparkle (Figma 577:8072) for a note about what the product does with the answer, or an
   * FA5 Solid glyph — `info-circle` (577:9087) — for a plain fact.
   */
  icon?: 'sparkle' | LineIconName;
  style?: StyleProp<ViewStyle>;
};

// Drawn at 390 (PROFILE 09 577:8071), in artboard units.
const RADIUS = 10 / 0.75;
const PAD_LEFT = 10 / 0.75;
const PAD_RIGHT = 12 / 0.75;
const PAD_Y = 9 / 0.75;
const GAP = 10 / 0.75;
/** The icon's 22 slot, the sparkle export's own box inside it, and the 16-tall rule. */
const SLOT = 22 / 0.75;
const SPARKLE_W = 22 / 0.75;
const SPARKLE_H = 21.5496 / 0.75;
const RULE_H = 16 / 0.75;

/**
 * The lavender one-liner under a profile editor (PROFILE 09 / 12 / 15 / 16): an icon, a short
 * rule, and a sentence on what the answer is used for. The same panel a job card's match reason
 * is (MatchReason, 498:23), for copy that is not about a job.
 */
export function NoteBar({ text, icon = 'sparkle', style }: NoteBarProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.bar, { backgroundColor: colors.brandSurface }, style]}>
      <View style={styles.slot}>
        {icon === 'sparkle' ? (
          <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />
        ) : (
          <Icon name={icon} size="md" color={colors.brand} />
        )}
      </View>
      <View style={[styles.rule, { backgroundColor: colors.matchReasonRule }]} />
      <Text variant="caption" color="textBody" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: s(RADIUS),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
    gap: s(GAP),
  },
  slot: { width: s(SLOT), height: s(SLOT), alignItems: 'center', justifyContent: 'center' },
  rule: { width: s(1), height: s(RULE_H) },
  text: { flex: 1 },
}));
