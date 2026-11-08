import { useRouter, useSegments } from 'expo-router';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type FC } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

import { a11yHiddenWhen, haptics, useReducedMotion } from '@/lib';
import { useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { activeTabFor, TABS } from './tabBarTabs';
import { scrollTabToTop, type TabName } from './tabScroll';

/** At 390: the pill's inner padding, the icon's box, and the gap between icon and label. */
const PAD = 6;
const ICON = 22;
const ICON_GAP = 8;
/** Extra room after the label, so the text never touches the gradient's round end. */
const LABEL_TAIL = 6;

/**
 * The bar's own spring (§193): quick and without a bounce, so the gradient pill lands where it is
 * going. Every tab and the pill run the same one from the same frame, so they stay locked together.
 */
const GLIDE = { duration: 420, dampingRatio: 0.88 } as const;

type Geometry = { left: number; width: number };

/**
 * Where every tab sits for a given selection. The selected tab is widened to fit its label; the
 * others are a square around their icon, unless the bar has room for every label (a tablet), when
 * every tab shows its label as the reference draws it. Spaced evenly across the pill.
 */
function layoutTabs(
  inner: number,
  tabHeight: number,
  expanded: Record<TabName, number>,
  active: TabName,
): { boxes: Record<TabName, Geometry>; roomy: boolean } {
  const all = TABS.reduce((sum, tab) => sum + expanded[tab.name], 0);
  const roomy = all <= inner;
  const widths = TABS.map((tab) => (roomy || tab.name === active ? expanded[tab.name] : tabHeight));
  const used = widths.reduce((sum, width) => sum + width, 0);
  const gap = Math.max(0, (inner - used) / (TABS.length - 1));
  const boxes = {} as Record<TabName, Geometry>;
  let left = 0;
  TABS.forEach((tab, index) => {
    const width = widths[index] ?? tabHeight;
    boxes[tab.name] = { left, width };
    left += width + gap;
  });
  return { boxes, roomy };
}

/**
 * The bottom bar (redrawn to the owner's reference, 2026-11-08, §193): a white pill of four tabs
 * with a soft violet glow, the selected tab a gradient pill with its icon and label in white. On a
 * tap the gradient glides and resizes to the new tab on the UI thread while the tabs make room, so
 * the whole bar moves as one. The AI button is its own circle beside it (`Fab`).
 *
 * Rendered as a sibling of the tab navigator rather than through the navigator's `tabBar` prop,
 * so the tabs layout can order it against the hosted sheets. That puts it outside the navigator,
 * so it drives itself: active tab from `useSegments()`, navigation through the typed hrefs.
 * It reserves no layout space: `Screen`'s `tabBarInset` is the single source of bottom padding.
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
    // One frame later, so the glide starts before the navigation's own render claims the thread.
    requestAnimationFrame(() => nav.navigate(target.href));
  }, []);

  // Each label's measured width, so the selected tab is exactly as wide as its words need.
  const [labels, setLabels] = useState<Partial<Record<TabName, number>>>({});
  const measure = useCallback((name: TabName, width: number) => {
    setLabels((seen) => (seen[name] === width ? seen : { ...seen, [name]: width }));
  }, []);

  const pad = u(PAD);
  const tabHeight = layout.pillHeight - pad * 2;
  const inner = layout.pillWidth - pad * 2;
  const iconSide = (tabHeight - u(ICON)) / 2;
  const expanded = useMemo(() => {
    const out = {} as Record<TabName, number>;
    for (const tab of TABS) {
      const label = labels[tab.name] ?? tab.label.length * u(8);
      out[tab.name] = iconSide + u(ICON) + u(ICON_GAP) + label + iconSide + u(LABEL_TAIL);
    }
    return out;
  }, [iconSide, labels, u]);
  const { boxes, roomy } = layoutTabs(inner, tabHeight, expanded, active);
  const current = boxes[active];

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
          <ActivePill left={current.left} width={current.width} height={tabHeight} />
          {TABS.map((tab) => (
            <BarTab
              key={tab.name}
              name={tab.name}
              label={tab.label}
              Icon={tab.Icon}
              IconActive={tab.IconActive}
              focused={tab.name === active}
              showLabel={roomy || tab.name === active}
              left={boxes[tab.name].left}
              width={boxes[tab.name].width}
              height={tabHeight}
              iconSide={iconSide}
              onPress={handlePress}
              onMeasure={measure}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Animates a box's left and width to where the layout says, on the shared glide. */
function useGlide(left: number, width: number) {
  const reduced = useReducedMotion();
  const x = useSharedValue(left);
  const w = useSharedValue(width);
  useEffect(() => {
    x.set(reduced ? left : withSpring(left, GLIDE));
    w.set(reduced ? width : withSpring(width, GLIDE));
  }, [left, reduced, w, width, x]);
  return useAnimatedStyle(() => ({ left: x.value, width: w.value }));
}

/** The selected tab's gradient pill, gliding and resizing under the tabs. */
function ActivePill({ left, width, height }: { left: number; width: number; height: number }) {
  const { colors } = useTheme();
  const id = `navPill${useId().replace(/:/g, '')}`;
  const glide = useGlide(left, width);
  return (
    <Animated.View
      testID="tab-light"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.active, { height, borderRadius: height / 2 }, glide]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.navGradientStart} />
            <Stop offset="0.5" stopColor={colors.navGradientMid} />
            <Stop offset="1" stopColor={colors.navGradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** The soft violet glow the bar floats on: an ellipse under it, drawn the same on every platform. */
function BarGlow({ width, height, color }: { width: number; height: number; color: string }) {
  const id = `navGlow${useId().replace(/:/g, '')}`;
  const w = width * 1.16;
  const h = height * 2.1;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.glow,
        { width: w, height: h, left: (width - w) / 2, top: height * 0.05 - h * 0.3 },
      ]}
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
  Icon: FC<SvgProps>;
  IconActive: FC<SvgProps>;
  focused: boolean;
  showLabel: boolean;
  left: number;
  width: number;
  height: number;
  iconSide: number;
  onPress: (name: TabName) => void;
  onMeasure: (name: TabName, width: number) => void;
};

/**
 * One tab: its icon at a fixed inset from the tab's left edge (so it never slides inside its
 * tab), and its label beside it, clipped by the tab's width as the tab grows and shrinks. White on
 * the gradient when selected, ink when not; the two cuts and colours cross-fade on the UI thread.
 * Memoised: only the tabs whose state or place changed re-render on a switch.
 */
const BarTab = memo(function BarTab({
  name,
  label,
  Icon,
  IconActive,
  focused,
  showLabel,
  left,
  width,
  height,
  iconSide,
  onPress,
  onMeasure,
}: BarTabProps) {
  const { colors, motion, u } = useTheme();
  const reduced = useReducedMotion();
  const glide = useGlide(left, width);
  const on = useSharedValue(focused ? 1 : 0);
  const shown = useSharedValue(showLabel ? 1 : 0);
  useEffect(() => {
    on.set(reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, motion.timings.base));
    shown.set(reduced ? (showLabel ? 1 : 0) : withTiming(showLabel ? 1 : 0, motion.timings.base));
  }, [focused, motion.timings.base, on, reduced, showLabel, shown]);

  const whiteStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const handlePress = useCallback(() => onPress(name), [name, onPress]);
  const icon = u(ICON);

  return (
    <Animated.View style={[styles.tab, { height }, glide]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        feedback="subtle"
        onPress={handlePress}
        style={[styles.press, { paddingLeft: iconSide, gap: u(ICON_GAP) }]}
      >
        <View style={{ width: icon, height: icon }}>
          <Animated.View style={[StyleSheet.absoluteFill, inkStyle]}>
            <Icon width={icon} height={icon} color={colors.navInactive} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, whiteStyle]}>
            <IconActive width={icon} height={icon} color={colors.textOnBrand} />
          </Animated.View>
        </View>
        <Animated.View style={labelStyle} {...a11yHiddenWhen(true)}>
          <View
            onLayout={(event: LayoutChangeEvent) =>
              onMeasure(name, Math.ceil(event.nativeEvent.layout.width))
            }
          >
            <Animated.View style={inkStyle}>
              <Text variant="bodyLgStrong" color="navInactive" numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, whiteStyle]}>
              <Text variant="bodyLgStrong" color="textOnBrand" numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
          </View>
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
  active: { position: 'absolute', top: 0, overflow: 'hidden' },
  tab: { position: 'absolute', top: 0, overflow: 'hidden' },
  press: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});
