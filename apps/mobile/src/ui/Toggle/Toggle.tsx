import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics, hitSlopFor, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  /** Accessible label — required; the switch has no text of its own. */
  label: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Figma 1:2721 — 52×32 track, 26pt knob, 3pt inset. */
const TRACK = { width: 52, height: 32 } as const;
const KNOB = 26;
const INSET = 3;
const TRAVEL = TRACK.width - KNOB - INSET * 2;

/**
 * The settings switch (NOTIF 04). Custom rather than RN's native Switch so the geometry and
 * colours match the artboard on both platforms; the knob rides the snappy spring (§4 "toggle
 * thumbs").
 */
export function Toggle({ value, onChange, label, disabled = false, style }: ToggleProps) {
  const { colors, motion, radii, shadows } = useTheme();
  const reduced = useReducedMotion();

  const position = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    position.set(withSpring(value ? 1 : 0, withReducedMotion(reduced, motion.springs.snappy)));
  }, [motion.springs.snappy, position, reduced, value]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: INSET + position.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      feedback="none"
      haptic="none"
      hitSlop={hitSlopFor(TRACK.height)}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      style={[
        {
          width: TRACK.width,
          height: TRACK.height,
          borderRadius: radii.full,
          backgroundColor: value ? colors.surfaceSelected : colors.progressTrack,
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          shadows.knob,
          { width: KNOB, height: KNOB, borderRadius: radii.full, backgroundColor: colors.surfaceCard },
          knobStyle,
        ]}
      />
    </Pressable>
  );
}
