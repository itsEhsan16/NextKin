import { useRouter, useSegments } from 'expo-router';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { a11yHiddenWhen, haptics, useReducedMotion } from '@/lib';
import { motion, useTabBarLayout, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { activeTabFor, TABS } from './tabBarTabs';
import { scrollTabToTop, type TabName } from './tabScroll';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * The bar's line icons (§194). The custom nav cuts were filled shapes with white cut-outs, which
 * read as outlines on white but turned into solid blobs on the gradient; stroke icons stay true
 * in white and in ink alike, as the reference draws them.
 */
const GLYPH: Record<TabName, LineIconName> = {
  index: 'Home02',
  jobs: 'Briefcase01',
  resumes: 'Folder',
};

/** At 390: the pill's inner padding, the icon's box, and the gap between icon and label. */
const PAD = 6;
const ICON = 22;
const ICON_GAP = 8;
/** Room after the label so it never touches the gradient's round end. */
const LABEL_TAIL = 8;

/**
 * The liquid move (§194): the pill's two ends travel on different springs. The end in front
 * leaps ahead, the end behind follows a beat later, so the pill stretches towards the new tab and
 * then draws itself in, like a drop running along the bar. Neither spring overshoots.
 */
const LEAD = motion.springs.barLead;
const TRAIL = motion.springs.barTrail;
/** The tabs and their icons move on one middle spring, between the two ends. */
const SLIDE = motion.springs.barSlide;

type Box = { left: number; width: number };

/**
 * Where every tab sits for a given selection. The selected tab is as wide as its icon and label;
 * the others are a square around the icon, unless the pill has room for every label (a tablet),
 * when all of them show it. Spaced evenly across the pill.
 */
function layoutTabs(
  inner: number,
  side: number,
  expanded: Record<TabName, number>,
  active: TabName,
): { boxes: Record<TabName, Box>; roomy: boolean } {
  const total = TABS.reduce((sum, tab) => sum + expanded[tab.name], 0);
  const roomy = total <= inner;
  const widths = TABS.map((tab) => (roomy || tab.name === active ? expanded[tab.name] : side));
  const used = widths.reduce((sum, width) => sum + width, 0);
  const gap = Math.max(0, (inner - used) / (TABS.length - 1));
  const boxes = {} as Record<TabName, Box>;
  let left = 0;
  TABS.forEach((tab, index) => {
    const width = widths[index] ?? side;
    boxes[tab.name] = { left, width };
    left += width + gap;
  });
  return { boxes, roomy };
}

/**
 * The bottom bar (owner's reference, §193; re-engineered §194): a white pill of four tabs on a soft
 * violet glow, the selected tab a gradient pill with its icon and label in white, and the AI
 * button its own circle beside it (`Fab`).
 *
 * Nothing here relies on clipping, which Android did not honour for the drawn gradient (its end
 * came out square) and which made labels measure as cut short:
 * - the gradient pill is one rounded rect inside an SVG that spans the whole track, its two ends
 *   animated as SVG props on the UI thread;
 * - each tab only moves (translate) and fades its label; it is never clipped;
 * - label widths come from an unconstrained, invisible copy, so they are the words' real width.
 *
 * Rendered as a sibling of the tab navigator, so it drives itself from `useSegments()`. It
 * reserves no layout space: `Screen`'s `tabBarInset` is the single source of bottom padding.
 */
export function FloatingTabBar() {
  const { colors, u } = useTheme();
  const layout = useTabBarLayout();
  const router = useRouter();
  const segments = useSegments();

  const routeActive = activeTabFor(segments);
  // The tab just pressed shows as selected before the route catches up; cleared once it moves.
  const [pressed, setPressed] = useState<TabName | null>(null);
  const [seenRoute, setSeenRoute] = useState(routeActive);
  if (seenRoute !== routeActive) {
    setSeenRoute(routeActive);
    setPressed(null);
  }
  const active = pressed ?? routeActive;

  const live = useRef({ active, router });
  useEffect(() => {
    live.current = { active, router };
  });

  const handlePress = useCallback((name: TabName) => {
    const { active: current, router: nav } = live.current;
    // Re-tapping the focused tab scrolls it to the top instead of re-navigating to itself.
    if (name === current) {
      if (scrollTabToTop(name)) haptics.selection();
      return;
    }
    const target = TABS.find((tab) => tab.name === name);
    if (!target) return;
    haptics.selection();
    setPressed(name);
    // One frame later, so the move starts before the navigation's own render claims the thread.
    requestAnimationFrame(() => nav.navigate(target.href));
  }, []);

  // Each label's real width, from the invisible measuring copies below.
  const [labels, setLabels] = useState<Partial<Record<TabName, number>>>({});
  const measure = useCallback((name: TabName, width: number) => {
    setLabels((seen) => (seen[name] === width ? seen : { ...seen, [name]: width }));
  }, []);

  const pad = u(PAD);
  const height = layout.pillHeight - pad * 2;
  const inner = layout.pillWidth - pad * 2;
  const icon = u(ICON);
  const inset = (height - icon) / 2;
  const expanded = useMemo(() => {
    const out = {} as Record<TabName, number>;
    for (const tab of TABS) {
      const label = labels[tab.name] ?? tab.label.length * u(9);
      out[tab.name] = inset + icon + u(ICON_GAP) + label + inset + u(LABEL_TAIL);
    }
    return out;
  }, [icon, inset, labels, u]);
  const { boxes, roomy } = layoutTabs(inner, height, expanded, active);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          left: layout.pillLeft,
          bottom: layout.bottomOffset,
          width: layout.pillWidth,
          height: layout.pillHeight,
        },
      ]}
    >
      <BarGlow width={layout.pillWidth} height={layout.pillHeight} color={colors.navGlow} />
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          {
            borderRadius: layout.pillRadius,
            backgroundColor: colors.tabBarBackground,
            borderColor: colors.borderSoft,
            padding: pad,
          },
        ]}
      >
        <View style={styles.track}>
          <LiquidPill track={inner} height={height} box={boxes[active]} />
          {TABS.map((tab) => (
            <BarTab
              key={tab.name}
              name={tab.name}
              label={tab.label}
              glyph={GLYPH[tab.name]}
              focused={tab.name === active}
              showLabel={roomy || tab.name === active}
              left={boxes[tab.name].left}
              width={boxes[tab.name].width}
              height={height}
              inset={inset}
              onPress={handlePress}
            />
          ))}
        </View>
      </View>
      {/* The labels at their natural width, invisible and out of the way, for measuring only. */}
      <View pointerEvents="none" style={styles.measure} {...a11yHiddenWhen(true)}>
        {TABS.map((tab) => (
          <Text
            key={tab.name}
            variant="bodyLgStrong"
            numberOfLines={1}
            onLayout={(event: LayoutChangeEvent) =>
              measure(tab.name, Math.ceil(event.nativeEvent.layout.width))
            }
          >
            {tab.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * The selected tab's gradient pill: one rounded rect in an SVG the size of the whole track. Its
 * left and right ends are separate springs (lead and trail), set as SVG props on the UI thread.
 */
function LiquidPill({ track, height, box }: { track: number; height: number; box: Box }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const id = `navPill${useId().replace(/:/g, '')}`;
  const leftEdge = useSharedValue(box.left);
  const rightEdge = useSharedValue(box.left + box.width);

  useEffect(() => {
    const right = box.left + box.width;
    if (reduced) {
      leftEdge.set(box.left);
      rightEdge.set(right);
      return;
    }
    // Moving right, the right end leads; moving left, the left end does.
    const goingRight = box.left > leftEdge.get();
    leftEdge.set(withSpring(box.left, goingRight ? TRAIL : LEAD));
    rightEdge.set(withSpring(right, goingRight ? LEAD : TRAIL));
  }, [box.left, box.width, leftEdge, reduced, rightEdge]);

  const shape = useAnimatedProps(() => ({
    x: leftEdge.value,
    width: Math.max(height, rightEdge.value - leftEdge.value),
  }));

  return (
    <View
      testID="tab-light"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.pillLayer, { width: track, height }]}
    >
      <Svg width={track} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.navGradientStart} />
            <Stop offset="0.5" stopColor={colors.navGradientMid} />
            <Stop offset="1" stopColor={colors.navGradientEnd} />
          </LinearGradient>
        </Defs>
        <AnimatedRect
          y={0}
          height={height}
          rx={height / 2}
          ry={height / 2}
          fill={`url(#${id})`}
          animatedProps={shape}
        />
      </Svg>
    </View>
  );
}

/** The soft violet glow the bar floats on: an ellipse under it, drawn the same everywhere. */
function BarGlow({ width, height, color }: { width: number; height: number; color: string }) {
  const id = `navGlow${useId().replace(/:/g, '')}`;
  const w = width * 1.16;
  const h = height * 2.1;
  return (
    <View
      pointerEvents="none"
      style={[styles.glow, { width: w, height: h, left: (width - w) / 2, top: -h * 0.3 }]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="58%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.12" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

type BarTabProps = {
  name: TabName;
  label: string;
  glyph: LineIconName;
  focused: boolean;
  showLabel: boolean;
  left: number;
  width: number;
  height: number;
  inset: number;
  onPress: (name: TabName) => void;
};

/**
 * One tab. It slides to its place (translate only) and its touch area follows; the icon sits a
 * fixed inset from the tab's left, so it rides with the tab and never shifts inside it. The icon
 * is the same line icon in both states, ink or white, cross-faded; the label fades in on the
 * selected tab once the pill is under it, and out at once when the tab is left, so a word never
 * hangs over a neighbour. Memoised: only tabs whose place or state changed re-render.
 */
const BarTab = memo(function BarTab({
  name,
  label,
  glyph,
  focused,
  showLabel,
  left,
  width,
  height,
  inset,
  onPress,
}: BarTabProps) {
  const { colors, motion, u } = useTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(left);
  const w = useSharedValue(width);
  const on = useSharedValue(focused ? 1 : 0);
  const words = useSharedValue(showLabel ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      x.set(left);
      w.set(width);
      return;
    }
    x.set(withSpring(left, SLIDE));
    w.set(withSpring(width, SLIDE));
  }, [left, reduced, w, width, x]);

  useEffect(() => {
    on.set(reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, motion.timings.base));
    words.set(
      reduced
        ? showLabel
          ? 1
          : 0
        : showLabel
          ? // In after the pill has mostly arrived; out straight away.
            withTiming(1, { ...motion.timings.base, duration: motion.durations.base })
          : withTiming(0, motion.timings.press),
    );
  }, [focused, motion, on, reduced, showLabel, words]);

  const place = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));
  const white = useAnimatedStyle(() => ({ opacity: on.value }));
  const ink = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: words.value }));
  const handlePress = useCallback(() => onPress(name), [name, onPress]);
  const size = u(ICON);

  return (
    <Animated.View style={[styles.tab, { height }, place]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        feedback="subtle"
        onPress={handlePress}
        style={[styles.press, { paddingLeft: inset, gap: u(ICON_GAP) }]}
      >
        <View style={{ width: size, height: size }}>
          <Animated.View style={[StyleSheet.absoluteFill, ink]}>
            <Icon name={glyph} size={size} color={colors.navInactive} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, white]}>
            <Icon name={glyph} size={size} color={colors.textOnBrand} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.label, labelStyle]} {...a11yHiddenWhen(true)}>
          <Animated.View style={ink}>
            <Text variant="bodyLgStrong" color="navInactive" numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, white]}>
            <Text variant="bodyLgStrong" color="textOnBrand" numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  glow: { position: 'absolute' },
  pill: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
  track: { flex: 1 },
  pillLayer: { position: 'absolute', top: 0, left: 0 },
  tab: { position: 'absolute', top: 0, left: 0 },
  press: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  // The label keeps its natural width even when its tab is narrower than it (no shrinking).
  label: { flexShrink: 0 },
  // Far off screen and never drawn: only its children's widths are read.
  measure: { position: 'absolute', left: '-500%', top: 0, opacity: 0, alignItems: 'flex-start' },
});
