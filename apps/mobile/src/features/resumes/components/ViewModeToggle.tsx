import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

import type { ResumesViewMode } from '../resumesStore';

export type ViewModeToggleProps = {
  value: ResumesViewMode;
  onChange: (mode: ResumesViewMode) => void;
  style?: StyleProp<ViewStyle>;
};

/** Figma 1:1374 — 104×52 track, 4pt inset, 48×44 white pill sliding between two icon cells. */
const TRACK_WIDTH = 104;
const TRACK_HEIGHT = 52;
const INSET = 4;
const CELL = (TRACK_WIDTH - INSET * 2) / 2;
const PILL_HEIGHT = TRACK_HEIGHT - INSET * 2;
const ICON = 15;

const MODES: readonly { key: ResumesViewMode; icon: string; label: string }[] = [
  { key: 'grid', icon: 'th-large', label: 'Grid view' },
  { key: 'list', icon: 'list', label: 'List view' },
];

/**
 * Grid ⇄ list switch. A miniature of SegmentedControl (which is label-only) with the same
 * sliding-pill spring; two fixed cells keep the geometry static so no measuring pass is needed.
 */
export function ViewModeToggle({ value, onChange, style }: ViewModeToggleProps) {
  const { colors, radii, shadows, motion, s } = useTheme();
  const reduced = useReducedMotion();

  const index = value === 'grid' ? 0 : 1;
  const offset = useSharedValue(INSET + index * CELL);
  const mounted = useRef(false);

  useEffect(() => {
    const target = INSET + index * CELL;
    if (!mounted.current) {
      // First paint seats the pill with no motion — a persisted "list" preference must not
      // replay a slide from grid on every entry.
      mounted.current = true;
      offset.set(target);
      return;
    }
    offset.set(withSpring(target, withReducedMotion(reduced, motion.springs.snappy)));
  }, [index, motion.springs.snappy, offset, reduced]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          width: s(TRACK_WIDTH),
          height: s(TRACK_HEIGHT),
          borderRadius: radii.xl,
          backgroundColor: colors.surfaceSubtle,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.pill,
          shadows.segmentPill,
          {
            width: s(CELL),
            height: s(PILL_HEIGHT),
            borderRadius: radii.md,
            backgroundColor: colors.surfaceCard,
          },
          pillStyle,
        ]}
      />
      {MODES.map((mode) => {
        const selected = mode.key === value;
        return (
          <Pressable
            key={mode.key}
            {...a11yButton(mode.label)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            feedback="none"
            haptic="none"
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(mode.key);
            }}
            style={styles.cell}
          >
            <FontAwesome5
              name={mode.icon}
              size={s(ICON)}
              color={selected ? colors.textPrimary : colors.iconMuted}
              solid
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', left: 0, top: INSET },
  cell: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
