import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NextStep from '../../../../assets/onboarding/next-step.svg';
import { board } from '../board';
import { AuthLockup } from '../components/AuthLockup';
import { LegalConsentLine } from '../components/LegalConsentLine';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

/** Figma 307:4338. */
const LAYOUT = {
  heroTop: 48.68,
  art: { width: 387.45, height: 200.5 },
  gutter: 22,
  gap: 12.21,
  floor: 105,
};
const BUTTON = { height: 57.86, arrow: 21, arrowRight: 31.75 };
/** The drawn fill: rgba(84,73,238,0.67) over white, to #A099FB. */

/**
 * Where a signed-out reader chooses between creating an account and signing in (Figma 307:4338).
 *
 * Static: nothing is fetched, so there is no loading, empty or error state to ship.
 *
 * No safe-area edges, for the reason `SignUpScreen` sets out: the artboard budgets the whole
 * screen — 97 of head room down to a 105 floor, summing to its own 895 — so taking insets on top
 * of that adds them twice.
 */
export function GetStartedScreen() {
  const router = useRouter();
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen edges={[]} padded={false}>
      <AuthLockup />

      <View
        accessible
        {...a11yHeader('A brighter you ahead.')}
        style={[styles.centred, { marginTop: s(board(LAYOUT.heroTop)) }]}
      >
        <Text variant="largeTitle" color="onboardingInk" align="center">
          {'A brighter\nyou '}
          <Text variant="largeTitle" color="authAccent">
            ahead.
          </Text>
        </Text>
      </View>

      <View style={styles.art}>
        <NextStep width={s(board(LAYOUT.art.width))} height={s(board(LAYOUT.art.height))} />
      </View>

      <View
        style={{
          paddingHorizontal: s(board(LAYOUT.gutter)),
          gap: s(board(LAYOUT.gap)),
          // The board's floor, or clear of a taller navigation bar.
          marginBottom: Math.max(s(board(LAYOUT.floor)), insets.bottom + s(16)),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          onPress={() => router.push('/(auth)/sign-up')}
          style={[
            styles.pill,
            {
              height: s(board(BUTTON.height)),
              borderRadius: radii.full,
              // The redesign's ink pill (§181) in place of the lavender gradient.
              backgroundColor: colors.ink,
            },
          ]}
        >
          <Text variant="buttonLabel" color="textOnDark">
            Create an account
          </Text>
          <Icon
            name="ArrowRight"
            size={s(30)}
            color={colors.textOnDark}
            style={{ position: 'absolute', right: s(board(BUTTON.arrowRight)) }}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={() => router.push('/(auth)/sign-in')}
          style={[
            styles.pill,
            {
              height: s(board(BUTTON.height)),
              borderRadius: radii.full,
              backgroundColor: colors.surfaceCard,
              borderWidth: s(board(1.062)),
              borderColor: colors.authFieldBorder,
            },
          ]}
        >
          <Text variant="buttonLabel" color="onboardingInk">
            Sign in
          </Text>
        </Pressable>

        <LegalConsentLine />
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
  // Shrinks on a short phone (360x640) rather than pushing the buttons off the glass.
  art: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
