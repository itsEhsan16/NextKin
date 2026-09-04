import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

const SEGMENTS = ['All', 'Saved', 'Applied'] as const;
const TRACK_PADDING = 3;
const SEGMENT_HEIGHT = 40;

/** (e) Segmented control: the active pill slides with `springs.snappy` (critically damped). */
export function SegmentedPillDemo() {
  const { colors, radii, shadows, motion, s } = useTheme();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = (e.nativeEvent.layout.width - TRACK_PADDING * 2) / SEGMENTS.length;
    setSegmentWidth(width);
    translateX.value = index * width;
  };

  const select = (next: number) => {
    if (next === index) return;
    haptics.selection();
    setIndex(next);
    translateX.value = withSpring(
      next * segmentWidth,
      withReducedMotion(reduced, motion.springs.snappy),
    );
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        { padding: s(TRACK_PADDING), borderRadius: radii.lg, backgroundColor: colors.surfaceSubtle },
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              top: s(TRACK_PADDING),
              left: s(TRACK_PADDING),
              width: segmentWidth,
              height: s(SEGMENT_HEIGHT),
              borderRadius: radii.md,
              backgroundColor: colors.surfaceCard,
            },
            shadows.card,
            pillStyle,
          ]}
        />
      ) : null}
      {SEGMENTS.map((label, i) => (
        <Pressable
          key={label}
          {...a11yButton(label)}
          accessibilityState={{ selected: i === index }}
          onPress={() => select(i)}
          style={[styles.segment, { height: s(SEGMENT_HEIGHT) }]}
        >
          <Text
            variant={i === index ? 'captionSemiBold' : 'caption'}
            color={i === index ? 'textPrimary' : 'textSecondary'}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
  pill: { position: 'absolute' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
