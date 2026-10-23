import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';
import { useLoop } from '@/ui/motion';

/**
 * Where the motion sits on one run illustration, in the PNG's own pixels (the 3× render). The art
 * is a flat image, so nothing in it can move; these mark what is drawn where, and the overlays are
 * laid on top in register: a glint on each baked sparkle, a scan over the page being read, ink
 * along the lines of the page being written.
 */
export type LiveAnchors = {
  /** The PNG's pixel size, which every other number here is measured in. */
  px: { w: number; h: number };
  /** Centre and size of each four-point sparkle drawn into the art. */
  sparkles: readonly { x: number; y: number; size: number }[];
  /** The page being analysed: centre, size and tilt in degrees (the scan stays inside it). */
  page?: { x: number; y: number; w: number; h: number; angle: number };
  /** The page's text lines, top to bottom: left end, length, thickness, all at one tilt. */
  lines?: {
    angle: number;
    thickness: number;
    rows: readonly { x: number; y: number; length: number }[];
  };
};

/** What the run is doing, which picks the overlay: reading a page, or writing one. */
export type LiveMotif = 'scan' | 'write';

export type LiveArtProps = {
  anchors: LiveAnchors;
  motif: LiveMotif;
  /** The run is working. Off, every overlay settles out of sight and the art rests. */
  active: boolean;
  /** The art's drawn width on screen; the anchors scale to it. */
  width: number;
};

// A four-point sparkle in a 24 box, the shape the illustrations draw.
const STAR =
  'M12 0 C12.8 6.4 17.6 11.2 24 12 C17.6 12.8 12.8 17.6 12 24 C11.2 17.6 6.4 12.8 0 12 C6.4 11.2 11.2 6.4 12 0 Z';
/** A glint is a smaller star of light on the sparkle's face. */
const GLINT_SHARE = 0.5;
/** The scan band's height, as a share of the page it crosses. */
const BAND_SHARE = 0.24;

/** One glint: a white star that flares on its sparkle once a cycle and is gone between. */
function Glint({
  x,
  y,
  size,
  clock,
}: {
  x: number;
  y: number;
  size: number;
  clock: SharedValue<number>;
}) {
  const { colors, motion, opacity } = useTheme();
  const peak = opacity.glint;
  const grow = motion.scales.twinkle;

  const flare = useAnimatedStyle(() => {
    const swell = Math.sin(Math.PI * clock.value);
    return { opacity: swell * peak, transform: [{ scale: swell * grow }] };
  });

  return (
    <Animated.View
      style={[
        styles.abs,
        { left: x - size / 2, top: y - size / 2, width: size, height: size },
        flare,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR} fill={colors.textOnBrand} />
      </Svg>
    </Animated.View>
  );
}

/** Three glints, a third of a cycle apart, so the sparkles take turns. */
function Glints({ anchors, k, active }: { anchors: LiveAnchors; k: number; active: boolean }) {
  const { motion } = useTheme();
  const offset = motion.loops.twinkle / 3;
  const first = useLoop(active, motion.loops.twinkle);
  const second = useLoop(active, motion.loops.twinkle, { delay: offset });
  const last = useLoop(active, motion.loops.twinkle, { delay: offset * 2 });
  const clocks = [first, second, last];

  return anchors.sparkles.slice(0, clocks.length).map((sparkle, index) => (
    <Glint
      key={`${sparkle.x}:${sparkle.y}`}
      x={sparkle.x * k}
      y={sparkle.y * k}
      size={sparkle.size * k * GLINT_SHARE}
      // The slice keeps the index inside `clocks`.
      clock={clocks[index] ?? first}
    />
  ));
}

/**
 * Analysis: a soft band of brand light passes down the page, inside its edges and at its tilt,
 * with a bright leading edge — the page being read line by line.
 */
function ScanBand({
  page,
  k,
  active,
}: {
  page: NonNullable<LiveAnchors['page']>;
  k: number;
  active: boolean;
}) {
  const { colors, motion, opacity, radii } = useTheme();
  const sweep = useLoop(active, motion.loops.scan);
  const w = page.w * k;
  const h = page.h * k;
  const band = h * BAND_SHARE;
  const tint = opacity.scan;

  const pass = useAnimatedStyle(() => {
    const t = sweep.value;
    // Fade in off the top and out past the bottom, so the loop has no visible restart.
    const edge = Math.min(1, t * 6, (1 - t) * 6);
    return { opacity: edge, transform: [{ translateY: -band + t * (h + band) }] };
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.clip,
        {
          left: page.x * k - w / 2,
          top: page.y * k - h / 2,
          width: w,
          height: h,
          borderRadius: radii.lg,
          transform: [{ rotate: `${page.angle}deg` }],
        },
      ]}
    >
      <Animated.View style={[styles.abs, { left: 0, right: 0, top: 0, height: band }, pass]}>
        <Svg width={w} height={band}>
          <Defs>
            <LinearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={tint} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={band} fill="url(#scan)" />
        </Svg>
        <View style={[styles.edge, { backgroundColor: colors.brand, opacity: opacity.ink }]} />
      </Animated.View>
    </View>
  );
}

/** One line of the page taking ink: a brand stroke that runs along it left to right. */
function InkLine({
  row,
  angle,
  thickness,
  k,
  index,
  count,
  clock,
}: {
  row: { x: number; y: number; length: number };
  angle: number;
  thickness: number;
  k: number;
  index: number;
  count: number;
  clock: SharedValue<number>;
}) {
  const { colors, opacity, radii } = useTheme();
  const length = row.length * k;
  const tall = thickness * k;
  const ink = opacity.ink;

  const run = useAnimatedStyle(() => {
    // One beat per line, then one beat where the whole page clears for the next pass.
    const t = clock.value * (count + 1);
    const progress = Math.max(0, Math.min(1, t - index));
    const clear = t > count ? 1 - (t - count) : 1;
    return { width: progress * length, opacity: clear * ink };
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: row.x * k,
          top: row.y * k - tall / 2,
          width: length,
          height: tall,
          transformOrigin: 'left center',
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    >
      <Animated.View
        style={[{ height: tall, borderRadius: radii.full, backgroundColor: colors.brand }, run]}
      />
    </View>
  );
}

/** Creation and generation: the page's lines darken one after another, like ink going down. */
function InkLines({
  lines,
  k,
  active,
}: {
  lines: NonNullable<LiveAnchors['lines']>;
  k: number;
  active: boolean;
}) {
  const { motion } = useTheme();
  const count = lines.rows.length;
  const clock = useLoop(active, motion.loops.writeLine * (count + 1));

  return lines.rows.map((row, index) => (
    <InkLine
      key={`${row.x}:${row.y}`}
      row={row}
      angle={lines.angle}
      thickness={lines.thickness}
      k={k}
      index={index}
      count={count}
      clock={clock}
    />
  ));
}

/**
 * The motion laid over a run's illustration while the run works (toreview §85): the sparkles
 * glint in turn, and the page either takes a scan (analysis) or takes ink line by line (writing).
 * The art itself stays exactly as the board draws it. Everything here is decorative and sits
 * under the art's own accessibility hiding; under Reduce Motion the clocks never start, so the
 * overlays stay out of sight and the art is still.
 */
export function LiveArt({ anchors, motif, active, width }: LiveArtProps) {
  const k = width / anchors.px.w;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {motif === 'scan' && anchors.page ? (
        <ScanBand page={anchors.page} k={k} active={active} />
      ) : null}
      {motif === 'write' && anchors.lines ? (
        <InkLines lines={anchors.lines} k={k} active={active} />
      ) : null}
      <Glints anchors={anchors} k={k} active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth * 3,
  },
});
