import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

/** Figma 307:4286 — a 72pt ink circle carrying the advance arrow. */
const BOX = 72;
const GLYPH = 26;

export type NextFabProps = {
  onPress: () => void;
  label: string;
};

/**
 * The advance control on onboarding slides 1 and 2.
 *
 * The board fills it with a radial gradient from #191C20 to #08090A — two steps of near-black
 * across 72pt, which no phone resolves as a gradient — so it is painted flat in `onboardingInk`.
 * The drawn glyph is a thin arrow character; FontAwesome carries the app's other 70-odd icons,
 * so it carries this one rather than introducing a text node sized like an icon.
 */
export function NextFab({ onPress, label }: NextFabProps) {
  const { colors, radii, shadows, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      haptic="medium"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.fab,
        shadows.fab,
        {
          width: s(board(BOX)),
          height: s(board(BOX)),
          borderRadius: radii.full,
          backgroundColor: colors.onboardingInk,
        },
      ]}
    >
      <FontAwesome5 name="arrow-right" size={s(board(GLYPH))} color={colors.textOnDark} solid />
    </Pressable>
  );
}

const useStyles = scaledSheet(() => ({
  fab: { alignItems: 'center', justifyContent: 'center' },
}));
