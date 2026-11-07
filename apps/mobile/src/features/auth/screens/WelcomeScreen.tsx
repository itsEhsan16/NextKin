import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { board } from '../board';
import { AuthGradient } from '../components/AuthGradient';
import { useOnboardingStore } from '../onboardingStore';
import { a11yHeader, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { BrandMark } from '@/ui/BrandMark';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/** How long the wash holds before the slides take over. */
const HOLD_MS = 1600;

/** Figma 307:4153 — the lock-up sits 20.5 above the frame's centre, and the tagline 82 off the floor. */
const CENTRE_OFFSET = 41;
const FLOOR_GAP = 82;
/** Drawn on the 422.66 board, so it goes through `board()` like every other length here. */
const MARK_HEIGHT = 104.95966;

/**
 * The first frame of a first run (Figma 307:4153).
 *
 * The artboard draws no control, so the screen advances itself: it is a held brand moment, not a
 * decision. A tap anywhere takes it early rather than making anyone wait out the hold, and the
 * fade is the only thing reduced motion removes — the advance still happens, because skipping it
 * would strand the reader on a screen with nothing to press. See toreview.md.
 *
 * Returning users never see it: `seen` is read synchronously at import, so the redirect resolves
 * on the first frame with no flash of the wash.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { motion, s } = useTheme();
  const styles = useStyles();
  const seen = useOnboardingStore((state) => state.seen);

  const fade = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (seen) return undefined;
    // The same 400 it always ran for, now read off the motion tokens with the house curve (§85).
    const timing = { duration: motion.durations.slow, easing: motion.easings.standard };
    fade.set(withTiming(1, withReducedMotion(reduced, timing)));
    const timer = setTimeout(() => router.replace('/(auth)/onboarding'), HOLD_MS);
    return () => clearTimeout(timer);
  }, [fade, motion.durations.slow, motion.easings.standard, reduced, router, seen]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  // Read above the effect's guard rather than before the hooks: a returning user goes straight
  // to the landing, and the slides they already walked are not part of signing back in.
  if (seen) return <Redirect href="/(auth)/get-started" />;

  return (
    <Screen edges={[]} padded={false}>
      <AuthGradient />
      <Pressable
        feedback="none"
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityHint="Skips the intro"
        onPress={() => router.replace('/(auth)/onboarding')}
        style={styles.fill}
      >
        <Animated.View style={[styles.fill, fadeStyle]}>
          <View style={[styles.lockUp, { paddingBottom: s(board(CENTRE_OFFSET)) }]}>
            <View accessible {...a11yHeader('NextKin')} style={styles.centred}>
              <BrandMark height={board(MARK_HEIGHT)} />
              <Text variant="welcomeWordmark" color="onboardingInk" align="center">
                NextKin
              </Text>
            </View>
            <Text variant="welcomeEyebrow" color="onboardingInk" align="center">
              JOBS RESUMES GROWTH
            </Text>
          </View>

          <View style={[styles.centred, { paddingBottom: s(board(FLOOR_GAP)) }]}>
            <Text variant="welcomeTagline" color="onboardingInk" align="center">
              {'WITH AI THAT WON’T LIE\nON YOUR RESUME.'}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  fill: { flex: 1 },
  centred: { alignItems: 'center' },
  lockUp: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}));
