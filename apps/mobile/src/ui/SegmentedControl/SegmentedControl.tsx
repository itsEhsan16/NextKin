import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type Segment<K extends string = string> = {
  key: K;
  label: string;
};

export type SegmentedControlProps<K extends string = string> = {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sliding-pill segmented control (Figma 1:283 — 48pt track, 4pt inset, 40pt pill at r12 with a
 * soft shadow). The pill translates on the UI thread between equal slots, so switching stays
 * smooth while the list underneath re-queries.
 */
export function SegmentedControl<K extends string = string>({
  segments,
  value,
  onChange,
  style,
}: SegmentedControlProps<K>) {
  const { colors, radii, sizes, shadows, motion } = useTheme();
  const reduced = useReducedMotion();

  const [trackWidth, setTrackWidth] = useState(0);
  // Derived from the two heights rather than scaled from the drawn 4pt: the track is read between
  // the artboards (see CONTROL_AT390) and the pill with it, so a hard-coded inset would drift from
  // their difference at some widths and park the pill off-centre. This cannot.
  const inset = (sizes.segmentedControl - sizes.segmentedPill) / 2;
  const slot = trackWidth > 0 ? (trackWidth - inset * 2) / segments.length : 0;
  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.key === value),
  );

  const offset = useSharedValue(0);
  // `slot` is 0 until onLayout measures the track, so the first pass has nowhere real to put the
  // pill — guarding the instant branch on `slot === 0` meant the *measured* pass always sprang.
  // With a persisted segment that read as the pill sliding over from Discover on every entry.
  const placed = useRef(false);
  useEffect(() => {
    if (slot === 0) return;
    const target = inset + index * slot;
    if (!placed.current) {
      // First real measurement: seat the pill under the active segment with no motion at all.
      placed.current = true;
      offset.set(target);
      return;
    }
    // Every deliberate switch after that animates.
    offset.set(withSpring(target, withReducedMotion(reduced, motion.springs.snappy)));
  }, [index, inset, motion.springs.snappy, offset, reduced, slot]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const measure = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const select = useCallback(
    (key: K) => {
      if (key === value) return;
      haptics.selection();
      onChange(key);
    },
    [onChange, value],
  );

  return (
    <View
      accessibilityRole="tablist"
      onLayout={measure}
      style={[
        styles.track,
        {
          height: sizes.segmentedControl,
          borderRadius: radii.xl,
          backgroundColor: colors.surfaceSubtle,
          padding: inset,
        },
        style,
      ]}
    >
      {slot > 0 ? (
        <Animated.View
          style={[
            styles.pill,
            shadows.segmentPill,
            {
              top: inset,
              width: slot,
              height: sizes.segmentedPill,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceCard,
            },
            pillStyle,
          ]}
        />
      ) : null}

      {segments.map((segment) => {
        const selected = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            {...a11yButton(segment.label)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            feedback="none"
            haptic="none"
            onPress={() => select(segment.key)}
            style={styles.segment}
          >
            <Text
              variant={selected ? 'segmentActive' : 'segment'}
              color={selected ? 'textPrimary' : 'textSecondary'}
              align="center"
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  // `top` is set inline from the derived inset — a raw artboard length here would not scale.
  pill: { position: 'absolute', left: 0 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
});
