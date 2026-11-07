import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import FabSparkleIcon from '../../assets/icons/nav/fab-sparkle.svg';
import { haptics, a11yButton, useReducedMotion } from '@/lib';
import { useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

/**
 * The AI sparkle (New Navigation / Home 669:49, glyph 670:197): one large four-point star and two
 * small ones, 27 × 25.49 on the 49.039 disc. Its middle sits a hair above the disc's centre (23.75
 * of 49.03), as drawn.
 */
const SPARKLE = { w: 27 / 49.039, h: 25.49 / 49.039, dy: (23.745 - 49.03 / 2) / 49.039 } as const;

/**
 * The FAB's violet glow (429:7617): offset 0 / 4, blur 10.9 (σ 5.45), `#3C29F6` at 75%, all on a
 * 49.039 disc, so every length scales with the FAB. `GLOW_STOPS` is the Gaussian edge profile
 * 0.75 × ½erfc(d / σ√2) sampled out to 3σ, as [distance in σ, alpha] — 37.5% at the rim, gone by 3σ.
 */
const DISC = 49.039;
const GLOW = { sigma: 5.45, dy: 4 } as const;
const GLOW_STOPS: readonly (readonly [number, number])[] = [
  [0, 0.375],
  [0.25, 0.3014],
  [0.5, 0.2314],
  [0.75, 0.1698],
  [1, 0.119],
  [1.25, 0.0792],
  [1.5, 0.0501],
  [2, 0.0171],
  [2.5, 0.0047],
  [3, 0],
];

/**
 * The glow as a radial gradient on a circle behind the FAB, not a View shadow or an SVG filter.
 * `shadows.fab` is coloured on iOS only (Android draws `elevation`, which is grey), and the bar's
 * filter rendered squashed on a device (toreview.md 51.2). A gradient draws the same everywhere.
 */
function FabGlow({
  size,
  bottom,
  pressed,
}: {
  size: number;
  bottom: number;
  /** The button's own press (0 → 1), so the glow shrinks with the disc instead of staying put. */
  pressed: SharedValue<number>;
}) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const pressedScale = reduced ? 1 : motion.scales.fabPressed;
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - pressedScale) }],
  }));
  const k = size / DISC;
  const radius = size / 2;
  const reach = 3 * GLOW.sigma * k;
  const box = size + 2 * reach;
  const outer = radius + reach;
  const stops = [
    // Under the disc: full strength (the FAB covers it; it only shows where the offset reveals it).
    { offset: 0, alpha: GLOW_STOPS[0]?.[1] ?? 0 },
    ...GLOW_STOPS.map(([d, alpha]) => ({ offset: (radius + d * GLOW.sigma * k) / outer, alpha })),
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        { width: box, height: box, bottom: bottom - reach - GLOW.dy * k },
        pressStyle,
      ]}
    >
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id="fabGlow" cx="50%" cy="50%" r="50%">
            {stops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={colors.fabFill}
                stopOpacity={stop.alpha}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={box / 2} cy={box / 2} r={outer} fill="url(#fabGlow)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * The centre button: the AI assistant's chat (owner, 2026-10-04 — it was the create "+"). One tap
 * opens the assistant. Creating lives where it is asked for, on Home's create tile and Resumes'
 * "+ New", which still raise the create sheet.
 */
export function Fab() {
  const { colors, radii } = useTheme();
  const layout = useTabBarLayout();
  const router = useRouter();
  const pressed = useSharedValue(0);

  return (
    <>
      <FabGlow size={layout.fabSize} bottom={layout.fabBottom} pressed={pressed} />
      <Pressable
        {...a11yButton('AI assistant', 'Opens the assistant chat')}
        // The deeper FAB press (0.92), shared with the glow so the two move as one.
        feedback="fab"
        pressProgress={pressed}
        onPress={() => {
          // Part of the bottom bar: one of the only places the app vibrates (owner, §191).
          haptics.light();
          router.push('/assistant');
        }}
        style={[
          styles.fab,
          {
            width: layout.fabSize,
            height: layout.fabSize,
            borderRadius: radii.full,
            bottom: layout.fabBottom,
            backgroundColor: colors.fabFill,
          },
        ]}
      >
        <FabSparkleIcon
          width={layout.fabSize * SPARKLE.w}
          height={layout.fabSize * SPARKLE.h}
          color={colors.fabGlyph}
          style={{ transform: [{ translateY: layout.fabSize * SPARKLE.dy }] }}
        />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: { position: 'absolute', alignSelf: 'center' },
});
