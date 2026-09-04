import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useMemo, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import {
  COMMIT_FRACTION,
  SWIPE_ACTION_WIDTH,
  clampSwipe,
  resolveSwipeSnap,
} from './swipeMath';

export type SwipeAction = {
  key: string;
  /** FA5 Solid glyph. */
  icon: string;
  label: string;
  /** Grey panel or the ink one (Figma 1:2542 / 1:2545). */
  tone: 'neutral' | 'ink';
  onPress: () => void;
};

export type SwipeableRowProps = {
  /** Revealed right-to-left, first action nearest the content edge. */
  actions: readonly SwipeAction[];
  /** A full swipe commits this (note 1:2600: "a full swipe commits Mark read"). */
  onFullSwipe?: () => void;
  children: ReactNode;
};

/**
 * Left-swipe row (NOTIF 02). A short swipe rests on the action panels, a full swipe commits
 * the primary action with a haptic at the threshold; a rightward flick closes. Swipe is never
 * the only path — every action here must also exist in the row's ⋯ menu (a11y, note 1:2600).
 * Horizontal intent is claimed via activeOffsetX so the vertical list keeps scrolling.
 */
export function SwipeableRow({ actions, onFullSwipe, children }: SwipeableRowProps) {
  const { colors, motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const [rowWidth, setRowWidth] = useState(0);
  // The panels themselves render at s(SWIPE_ACTION_WIDTH); reserving the raw width left a
  // third of the tray empty at 390.
  const actionsWidth = actions.length * s(SWIPE_ACTION_WIDTH);

  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  // Fires the threshold haptic exactly once per gesture.
  const passedCommit = useSharedValue(false);

  const snapSpring = useMemo(
    () => withReducedMotion(reduced, motion.springs.snappy),
    [motion.springs.snappy, reduced],
  );

  const settle = (to: number) => {
    'worklet';
    offset.set(withSpring(to, snapSpring));
  };

  const commit = useMemo(() => {
    const action = onFullSwipe ?? actions[0]?.onPress;
    return () => {
      haptics.light();
      action?.();
    };
  }, [actions, onFullSwipe]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Claim horizontal before the vertical list; give up quickly on vertical intent.
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onStart(() => {
          start.set(offset.value);
          passedCommit.set(false);
        })
        .onUpdate((event) => {
          const next = clampSwipe(start.value + event.translationX, rowWidth || 1);
          offset.set(next);
          const past = next < -(rowWidth || 1) * COMMIT_FRACTION;
          if (past && !passedCommit.value) {
            passedCommit.set(true);
            runOnJS(haptics.light)();
          }
        })
        .onEnd((event) => {
          const snap = resolveSwipeSnap(
            start.value + event.translationX,
            event.velocityX,
            actionsWidth,
            rowWidth || 1,
          );
          if (snap === 'commit') {
            runOnJS(commit)();
            settle(0);
          } else if (snap === 'open') {
            settle(-actionsWidth);
          } else {
            settle(0);
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle is a stable worklet closure over offset/snapSpring.
    [actionsWidth, commit, offset, passedCommit, rowWidth, snapSpring, start],
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const measure = (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width);

  const panel = (tone: SwipeAction['tone']): { bg: string; fg: ColorToken } =>
    tone === 'ink'
      ? { bg: colors.surfaceInverse, fg: 'textOnDark' }
      : { bg: colors.borderDefault, fg: 'textPrimary' };

  return (
    <View onLayout={measure} style={styles.row}>
      <View style={[styles.actions, { width: actionsWidth }]}>
        {actions.map((action) => {
          const look = panel(action.tone);
          return (
            <Pressable
              key={action.key}
              {...a11yButton(action.label)}
              feedback="subtle"
              haptic="light"
              onPress={() => {
                offset.set(withTiming(0, withReducedMotion(reduced, motion.timings.fast)));
                action.onPress();
              }}
              style={[styles.action, { width: s(SWIPE_ACTION_WIDTH), backgroundColor: look.bg }]}
            >
              <FontAwesome5 name={action.icon} size={s(17)} color={colors[look.fg]} solid />
              <Text variant="microBadge" color={look.fg} align="center">
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={contentStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { overflow: 'hidden' },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: { alignItems: 'center', justifyContent: 'center', gap: s(8) },
}));
