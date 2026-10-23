import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import NextStep from '../../../../assets/onboarding/next-step.svg';
import { board } from '../board';
import { AuthLockup } from '../components/AuthLockup';
import { GradientPill } from '../components/GradientPill';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/** Figma 307:4338. */
const LAYOUT = { heroTop: 48.68, art: { width: 387.45, height: 200.5 }, gutter: 22, gap: 12.21, floor: 105 };
const BUTTON = { height: 57.86, arrow: 21, arrowRight: 31.75 };
/** The drawn fill: rgba(84,73,238,0.67) over white, to #A099FB. */
const PILL = { from: '#8E88F4', to: '#A099FB' };

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

  return (
    <Screen edges={[]} padded={false}>
      <AuthLockup />

      <View
        accessible
        {...a11yHeader('A brighter you ahead.')}
        style={[styles.centred, { marginTop: s(board(LAYOUT.heroTop)) }]}
      >
        <Text variant="authHero" color="onboardingInk" align="center">
          {'A brighter\nyou '}
          <Text variant="authHero" color="authAccent">
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
          marginBottom: s(board(LAYOUT.floor)),
        }}
      >
        <Pressable
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          onPress={() => router.push('/(auth)/sign-up')}
          style={[styles.pill, { height: s(board(BUTTON.height)), borderRadius: radii.full }]}
        >
          <GradientPill from={PILL.from} to={PILL.to} />
          <Text variant="authButton" color="onboardingInk">
            Create an account
          </Text>
          <FontAwesome5
            name="arrow-right"
            size={s(board(BUTTON.arrow))}
            color={colors.onboardingInk}
            style={{ position: 'absolute', right: s(board(BUTTON.arrowRight)) }}
          />
        </Pressable>

        <Pressable
          haptic="light"
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
          <Text variant="authButton" color="onboardingInk">
            Sign in
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  centred: { alignItems: 'center' },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
}));
