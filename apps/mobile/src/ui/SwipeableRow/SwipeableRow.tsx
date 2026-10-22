import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { SWIPE_ACTION_WIDTH, clampSwipe, isPastCommit, resolveSwipeSnap } from './swipeMath';
import { claimSwipeRow, releaseSwipeRow, type SwipeRowHandle } from './swipeRegistry';

export type SwipeAction = {
  key: string;
  /** FA5 Solid glyph. */
  icon: string;
  label: string;
  /** Brand (the primary, e.g. Mark read), ink (More) or a quiet grey. */
  tone: 'brand' | 'ink' | 'neutral';
  onPress: () => void;
};

export type SwipeableRowProps = {
  /** Revealed right-to-left, first action nearest the content edge. */
  actions: readonly SwipeAction[];
  /**
   * A full swipe commits this (note 1:2600: "a full swipe commits Mark read"), and the first
   * panel stretches across the row once the swipe passes the line. Leave it out and a long swipe
   * simply rests open.
   */
  onFullSwipe?: () => void;
  /** Corner radius of the card this row wraps; each action button wears the same corner. */
  radius?: number;
  /**
   * Identity of the item the row is showing. A recycling list (FlashList) reuses a mounted row for
   * another item; when this changes the row closes, so a swiped-open cell never reappears open
   * under a different notification.
   */
  resetKey?: string;
  /** Outer box — margins. The card's own shadow belongs on the card, so it travels with it. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** A swipe-back past this much displacement past the panels resists instead of following. */
const OVERDRAG_RESISTANCE = 0.35;
/** Card → first button, and button → button, at 390. */
const BUTTON_GAP = 8 / 0.75;

/**
 * Left-swipe row (NOTIF 02). A short swipe rests on the action panels; a full swipe commits the
 * primary action — the first panel stretches across the row as the swipe passes the line, with a
 * haptic, and stretching back un-arms it. A rightward flick, a tap on the row, starting to swipe
 * another row, or scrolling the list (`closeOpenSwipeRow`) closes it.
 *
 * Swipe is never the only path (note 1:2600): every action here must also be in the row's ⋯ menu,
 * and the row's own content should expose them as `accessibilityActions`. The panels are hidden
 * from screen readers for that reason — VoiceOver and TalkBack cannot perform the swipe, and a
 * focusable button that is off-screen until swiped is a trap.
 *
 * Horizontal intent is claimed via activeOffsetX so the vertical list keeps scrolling.
 */
export function SwipeableRow({
  actions,
  onFullSwipe,
  radius = 0,
  resetKey,
  style,
  children,
}: SwipeableRowProps) {
  const { motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const [rowWidth, setRowWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const panelWidth = s(SWIPE_ACTION_WIDTH);
  const gap = s(BUTTON_GAP);
  const actionsWidth = actions.length * (panelWidth + gap);
  const canCommit = onFullSwipe !== undefined;

  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  /** 0 → 1 as the swipe passes the commit line; drives the first panel's stretch. */
  const armed = useSharedValue(0);
  const pastCommit = useSharedValue(false);

  const snapSpring = useMemo(
    () => withReducedMotion(reduced, motion.springs.snappy),
    [motion.springs.snappy, reduced],
  );
  const fast = useMemo(
    () => withReducedMotion(reduced, motion.timings.fast),
    [motion.timings.fast, reduced],
  );

  // The handle the open-row registry holds; another row starting a swipe calls its `close`.
  const handle = useMemo<SwipeRowHandle>(
    () => ({
      close: () => {
        offset.set(withSpring(0, snapSpring));
        armed.set(0);
        setOpen(false);
      },
    }),
    [armed, offset, snapSpring],
  );

  const closeSelf = useCallback(() => {
    handle.close();
    releaseSwipeRow(handle);
  }, [handle]);

  // A recycled cell showing a different item starts closed.
  const [shownKey, setShownKey] = useState(resetKey);
  if (shownKey !== resetKey) {
    setShownKey(resetKey);
    setOpen(false);
  }
  useEffect(() => {
    offset.set(0);
    armed.set(0);
    releaseSwipeRow(handle);
  }, [armed, handle, offset, resetKey]);
  useEffect(() => () => releaseSwipeRow(handle), [handle]);

  const claim = useCallback(() => claimSwipeRow(handle), [handle]);
  const settled = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) claimSwipeRow(handle);
      else releaseSwipeRow(handle);
    },
    [handle],
  );
  const commit = useCallback(() => onFullSwipe?.(), [onFullSwipe]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Claim horizontal before the vertical list; give up quickly on vertical intent.
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onStart(() => {
          start.set(offset.value);
          pastCommit.set(false);
          runOnJS(claim)();
        })
        .onUpdate((event) => {
          const width = rowWidth || 1;
          let next = clampSwipe(start.value + event.translationX, width);
          if (!canCommit && next < -actionsWidth) {
            next = -actionsWidth + (next + actionsWidth) * OVERDRAG_RESISTANCE;
          }
          offset.set(next);
          if (!canCommit) return;
          const past = isPastCommit(next, width);
          if (past !== pastCommit.value) {
            pastCommit.set(past);
            armed.set(withTiming(past ? 1 : 0, fast));
            if (past) runOnJS(haptics.light)();
          }
        })
        .onEnd((event) => {
          const snap = resolveSwipeSnap(
            start.value + event.translationX,
            event.velocityX,
            actionsWidth,
            rowWidth || 1,
            canCommit,
          );
          armed.set(withTiming(0, fast));
          if (snap === 'commit') runOnJS(commit)();
          offset.set(withSpring(snap === 'open' ? -actionsWidth : 0, snapSpring));
          runOnJS(settled)(snap === 'open');
        }),
    [
      actionsWidth,
      armed,
      canCommit,
      claim,
      commit,
      fast,
      offset,
      pastCommit,
      rowWidth,
      settled,
      snapSpring,
      start,
    ],
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  // Exactly as wide as the gap the card has left, so the buttons appear from behind its edge and
  // nothing shows at rest.
  const trayStyle = useAnimatedStyle(() => ({ width: Math.max(0, -offset.value) }));

  const measure = (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width);

  return (
    <View style={style}>
      <View onLayout={measure}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.tray, trayStyle]}
        >
          {actions.map((action, index) => (
            <ActionPanel
              key={action.key}
              action={action}
              first={index === 0}
              width={panelWidth}
              gap={gap}
              radius={radius}
              armed={armed}
              onPress={() => {
                closeSelf();
                action.onPress();
              }}
            />
          ))}
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={contentStyle}>
            {children}
            {/* While open, a tap on the row closes it rather than opening the item behind it. */}
            {open ? (
              <Pressable
                accessible={false}
                importantForAccessibility="no"
                feedback="none"
                onPress={closeSelf}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

type ActionPanelProps = {
  action: SwipeAction;
  /** Nearest the content: the full-swipe action, which grows to fill the row while armed. */
  first: boolean;
  width: number;
  gap: number;
  radius: number;
  armed: SharedValue<number>;
  onPress: () => void;
};

const LOOK: Record<SwipeAction['tone'], { bg: ColorToken; fg: ColorToken }> = {
  brand: { bg: 'brand', fg: 'textOnBrand' },
  ink: { bg: 'surfaceInverse', fg: 'textOnDark' },
  neutral: { bg: 'surfaceSubtle', fg: 'textPrimary' },
};

/**
 * One action: a rounded button of its own, standing a gap away from the card with the card's own
 * corner, rather than a square panel tucked under it — the slice the device pass found looked
 * unfinished against a rounded card.
 */
function ActionPanel({ action, first, width, gap, radius, armed, onPress }: ActionPanelProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const look = LOOK[action.tone];

  // The buttons behind the stretching one fold away, gap and all, as it takes the row (`armed`
  // only moves on a row that can commit).
  const folding = useAnimatedStyle(() =>
    first ? {} : { width: width * (1 - armed.value), marginLeft: gap * (1 - armed.value) },
  );

  return (
    <Animated.View
      style={[
        styles.panel,
        { backgroundColor: colors[look.bg], borderRadius: radius, marginLeft: gap },
        first ? { flexGrow: 1, minWidth: width } : { width },
        folding,
      ]}
    >
      <Pressable
        {...a11yButton(action.label)}
        feedback="subtle"
        haptic="light"
        onPress={onPress}
        // The label keeps its own width and hugs the row's edge as the panel stretches.
        style={[styles.action, { width }]}
      >
        <FontAwesome5 name={action.icon} size={s(17)} color={colors[look.fg]} solid />
        <Text variant="microBadge" color={look.fg} align="center">
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  tray: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  panel: { overflow: 'hidden', flexShrink: 0 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(8) },
}));
