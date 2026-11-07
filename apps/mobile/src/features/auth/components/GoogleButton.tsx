import GoogleLogo from '../../../../assets/logos/google.svg';
import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type GoogleButtonProps = {
  height: number;
  logo: number;
  gap: number;
  hairline: number;
  onPress: () => void;
};

/**
 * "Continue with Google" (Figma 307:4429 / 309:341) — the only provider either board draws,
 * whatever V2 §7.1 will eventually want of Apple.
 *
 * The mark is the repo's committed `google.svg`. The sign-in board exports its own copy at a
 * slightly different precision; they are the same drawing, and one Google mark across the two
 * forms beats two that differ in the third decimal.
 */
export function GoogleButton({ height, logo, gap, hairline, onPress }: GoogleButtonProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      style={[
        styles.pill,
        {
          height: s(board(height)),
          borderRadius: radii.full,
          gap: s(board(gap)),
          borderWidth: s(board(hairline)),
          borderColor: colors.authFieldBorder,
          backgroundColor: colors.surfaceCard,
        },
      ]}
    >
      <GoogleLogo width={s(board(logo))} height={s(board(logo))} />
      <Text variant="buttonLabel" color="onboardingInk">
        Continue with Google
      </Text>
    </Pressable>
  );
}

const useStyles = scaledSheet(() => ({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
