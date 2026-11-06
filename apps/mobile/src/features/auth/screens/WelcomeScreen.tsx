import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backendAuth } from '@/data/queries';
import { a11yHeader, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { BrandMark } from '@/ui/BrandMark';
import { Button } from '@/ui/Button';
import { GradientWash } from '@/ui/GradientWash';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import GoogleLogo from '../../../../assets/logos/google.svg';
import { useFirstRunStore } from '../firstRunStore';
import { useOnboardingStore } from '../onboardingStore';
import { useSessionStore } from '../sessionStore';

const PEOPLE = [
  require('../../../../assets/onboarding/people/p1.webp'),
  require('../../../../assets/onboarding/people/p2.webp'),
  require('../../../../assets/onboarding/people/p3.webp'),
  require('../../../../assets/onboarding/people/p4.webp'),
  require('../../../../assets/onboarding/people/p5.webp'),
  require('../../../../assets/onboarding/people/p6.webp'),
];

/**
 * Collage layout at 390: [x, y, width, height] of each portrait tile. Tall rounded capsules,
 * staggered like a gallery wall, a few cropped by the screen edge so the wall reads as larger.
 */
const TILES: readonly (readonly [number, number, number, number])[] = [
  [-28, 70, 96, 132],
  [82, 26, 110, 150],
  [206, 54, 104, 140],
  [322, 18, 96, 128],
  [30, 220, 104, 140],
  [252, 206, 110, 148],
];

function FloatingChip({
  children,
  delay,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  style: object;
}) {
  const reduced = useReducedMotion();
  const { colors, radii, shadows, u } = useTheme();
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    bob.set(
      withRepeat(
        withSequence(withTiming(-u(5), { duration: 1800 }), withTiming(0, { duration: 1800 })),
        -1,
        true,
      ),
    );
  }, [bob, reduced, u]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.get() }] }));
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInUp.delay(delay).duration(500)}
      style={[
        {
          position: 'absolute',
          flexDirection: 'row',
          alignItems: 'center',
          gap: u(6),
          paddingHorizontal: u(12),
          paddingVertical: u(8),
          borderRadius: radii.full,
          backgroundColor: colors.surfaceCard,
        },
        shadows.soft,
        style,
        bobStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The signed-out landing (toreview.md §172). One screen does what the welcome wash, the three
 * slides and the Get Started choice used to: show real people, one promise, and the way in.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { colors, sizes, u } = useTheme();
  const styles = useStyles();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const markFirstRun = useFirstRunStore((state) => state.mark);
  const signIn = useSessionStore((state) => state.signIn);

  const google = () => {
    markSeen();
    markFirstRun();
    signIn();
  };

  return (
    <View style={styles.page}>
      <GradientWash depth={0.75} />

      <View style={[styles.brandRow, { paddingTop: insets.top + u(12) }]}>
        <View accessible {...a11yHeader('NextKin')} style={styles.brand}>
          <BrandMark height={28 / 0.75} />
          <Text variant="title2" color="ink">
            NextKin
          </Text>
        </View>
      </View>

      <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {TILES.map(([x, y, w, h], index) => (
          <Animated.View
            key={index}
            entering={reduced ? undefined : FadeInDown.delay(80 * index).duration(600)}
            style={[
              styles.tile,
              { borderColor: colors.surfaceCard },
              { left: u(x), top: u(y), width: u(w), height: u(h), borderRadius: u(w / 2) },
            ]}
          >
            <Image source={PEOPLE[index]} style={styles.fill} contentFit="cover" transition={200} />
          </Animated.View>
        ))}
        <FloatingChip delay={650} style={{ left: u(150), top: u(196) }}>
          <Icon name="Stars02" size="sm" color={colors.brand} />
          <Text variant="footnote" color="ink">
            92% match
          </Text>
        </FloatingChip>
        <FloatingChip delay={800} style={{ left: u(132), top: u(318) }}>
          <Icon name="CheckCircle" size="sm" color={colors.success} />
          <Text variant="footnote" color="ink">
            Resume ready
          </Text>
        </FloatingChip>
      </View>

      <Animated.View
        entering={reduced ? undefined : FadeInUp.delay(200).duration(600)}
        style={[styles.sheet, { backgroundColor: colors.surfacePage, paddingBottom: insets.bottom + u(16) }]}
      >
        <Text variant="largeTitle" color="ink" align="center" {...a11yHeader('Resumes that get you hired.')}>
          {'Resumes that get\nyou hired.'}
        </Text>
        <Text variant="bodyLg" color="textSecondary" align="center" style={styles.lede}>
          Made for each job. Never made up.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Get started"
            size="xl"
            block
            onPress={() => {
              markSeen();
              router.push('/(auth)/sign-up');
            }}
          />
          {/* Google is wired on the mock only; on the backend it would be a dead end (§172). */}
          {!backendAuth ? (
            <Button
              label="Continue with Google"
              variant="outline"
              size="xl"
              block
              leading={<GoogleLogo width={sizes.iconSm} height={sizes.iconSm} />}
              onPress={google}
            />
          ) : null}
        </View>

        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={() => {
            markSeen();
            router.push('/(auth)/sign-in');
          }}
          style={styles.signIn}
        >
          <Text variant="callout" color="textSecondary">
            Have an account?
          </Text>
          <Text variant="bodySemiBold" color="ink">
            Sign in
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  page: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  brandRow: { alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  collage: { flex: 1, marginTop: u(8), overflow: 'hidden' },
  tile: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: u(3),
  },
  sheet: {
    paddingHorizontal: u(24),
    paddingTop: u(28),
    borderTopLeftRadius: u(32),
    borderTopRightRadius: u(32),
  },
  lede: { marginTop: u(10) },
  actions: { marginTop: u(28), gap: u(12) },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(4),
    alignSelf: 'center',
    marginTop: u(18),
    padding: u(6),
  },
}));
