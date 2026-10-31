import { View, type StyleProp, type ViewStyle } from 'react-native';

import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

export type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'plain';

export type PillProps = {
  label: string;
  tone?: PillTone;
  /** The 6 dot before the label — a count of marks (INTERVIEW 01 577:975). */
  dot?: boolean;
  /** An FA5 Solid glyph before the label, in the label's colour — ✓ Confident (577:3893). */
  icon?: LineIconName;
  style?: StyleProp<ViewStyle>;
};

// The small status pill at 390 (INTERVIEW 01 577:975, ASSISTANT 01 577:6537), in artboard units.
const PAD_LEFT = 9 / 0.75;
const PAD_RIGHT = 10 / 0.75;
const PAD_Y = 4 / 0.75;
const GAP = 5 / 0.75;
const DOT = 6 / 0.75;

const TONES: Record<PillTone, { bg: ColorToken; fg: ColorToken; dot: ColorToken }> = {
  neutral: { bg: 'surfaceSubtle', fg: 'textBody', dot: 'iconMuted' },
  brand: { bg: 'brandSurface', fg: 'brand', dot: 'brand' },
  success: { bg: 'successSurface', fg: 'success', dot: 'successIcon' },
  warning: { bg: 'warningSurface', fg: 'warningStrong', dot: 'warningAccent' },
  /** White on a grey surface — the assistant's "Out of scope" (577:6537). */
  plain: { bg: 'surfaceCard', fg: 'textBody', dot: 'iconMuted' },
};

/**
 * The fully rounded label the redesigned boards put on cards and bubbles: practice marks, question
 * tags, "Out of scope". Static — a pill that does something is a chip or a button. The profile's
 * "Current" (`StatusPill`, 573:44) is the same shape.
 */
export function Pill({ label, tone = 'neutral', dot = false, icon, style }: PillProps) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  const look = TONES[tone];

  return (
    <View
      style={[styles.pill, { borderRadius: radii.full, backgroundColor: colors[look.bg] }, style]}
    >
      {dot ? (
        <View
          style={[styles.dot, { borderRadius: radii.full, backgroundColor: colors[look.dot] }]}
        />
      ) : null}
      {icon ? <Icon name={icon} size="xs" color={colors[look.fg]} /> : null}
      <Text variant="microBadge" color={look.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: s(GAP),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
  },
  dot: { width: s(DOT), height: s(DOT) },
}));
