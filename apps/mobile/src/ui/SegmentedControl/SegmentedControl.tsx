import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { a11yButton, a11yHiddenWhen, hitSlopFor } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useSelectionProgress, useSlidingPill } from '@/ui/motion';

export type Segment<K extends string = string> = {
  key: K;
  label: string;
};

export type SegmentedControlProps<K extends string = string> = {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  /**
   * 'sm' is the compact track beside a section title (BILLING 01 577:9232): 36 tall at 390 with a
   * 30 pill, r12/r9 and 13pt labels. Its segments keep a 44pt target through hit slop.
   */
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
};

// The compact track at 390 (577:9232), in artboard units.
const SM_TRACK = 36 / 0.75;
const SM_PILL = 30 / 0.75;
const SM_TRACK_RADIUS = 12 / 0.75;
const SM_PILL_RADIUS = 9 / 0.75;

/**
 * Sliding-pill segmented control (Figma 1:283 — 48pt track, 4pt inset, 40pt pill at r12 with a
 * soft shadow). The pill translates on the UI thread between equal slots, so switching stays
 * smooth while the list underneath re-queries.
 */
export function SegmentedControl<K extends string = string>({
  segments,
  value,
  onChange,
  size = 'md',
  style,
}: SegmentedControlProps<K>) {
  const { colors, radii, sizes, shadows, s } = useTheme();
  const compact = size === 'sm';
  const trackHeight = compact ? s(SM_TRACK) : sizes.segmentedControl;
  const pillHeight = compact ? s(SM_PILL) : sizes.segmentedPill;
  // Vertical only: sideways slop would reach into the neighbouring segment.
  const { top, bottom } = hitSlopFor(trackHeight);
  const verticalSlop = { top, bottom };

  const [trackWidth, setTrackWidth] = useState(0);
  // Derived from the two heights rather than scaled from the drawn 4pt: the track is read between
  // the artboards (see CONTROL_AT390) and the pill with it, so a hard-coded inset would drift from
  // their difference at some widths and park the pill off-centre. This cannot.
  const inset = (trackHeight - pillHeight) / 2;
  const slot = trackWidth > 0 ? (trackWidth - inset * 2) / segments.length : 0;
  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.key === value),
  );

  // `slot` is 0 until onLayout measures the track, so there is nowhere real to put the pill yet.
  const pillStyle = useSlidingPill(slot > 0 ? inset + index * slot : null);

  const measure = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const select = useCallback(
    (key: K) => {
      if (key === value) return;
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
          height: trackHeight,
          // Pill track and pill thumb (§176).
          borderRadius: compact ? s(SM_TRACK_RADIUS) : radii.full,
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
              height: pillHeight,
              borderRadius: compact ? s(SM_PILL_RADIUS) : radii.full,
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
            feedback="subtle"
            hitSlop={compact ? verticalSlop : undefined}
            onPress={() => select(segment.key)}
            style={styles.segment}
          >
            <SegmentLabel label={segment.label} selected={selected} compact={compact} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A segment's label as two stacked copies — regular grey and semibold ink — that cross-fade with
 * the pill, so weight and colour change together instead of snapping at the tap.
 */
function SegmentLabel({
  label,
  selected,
  compact,
}: {
  label: string;
  selected: boolean;
  compact: boolean;
}) {
  const progress = useSelectionProgress(selected);
  const onStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={styles.labelStack}>
      <Animated.View style={offStyle} {...a11yHiddenWhen(selected)}>
        <Text
          variant={compact ? 'caption' : 'segment'}
          color="textSecondary"
          align="center"
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, onStyle]}
        {...a11yHiddenWhen(!selected)}
      >
        <Text
          variant={compact ? 'captionSemiBold' : 'segmentActive'}
          color="textPrimary"
          align="center"
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  // `top` is set inline from the derived inset — a raw artboard length here would not scale.
  pill: { position: 'absolute', left: 0 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  // Spans the whole segment, so the bolder copy laid over the regular one is never squeezed.
  labelStack: { alignSelf: 'stretch' },
});
