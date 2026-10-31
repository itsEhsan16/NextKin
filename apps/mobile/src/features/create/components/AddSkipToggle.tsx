import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptics, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useSlidingPill } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

export type TailorChoice = 'add' | 'skip';

export type AddSkipToggleProps = {
  /** The keyword the answer is for; it names both radios for a screen reader. */
  keyword: string;
  value: TailorChoice;
  onChange: (value: TailorChoice) => void;
};

// The Add / Skip track at 390 (TAILOR 03 608:155), in artboard units.
const INSET = 3 / 0.75;
const SEGMENT_W = 58 / 0.75;
const SEGMENT_H = 30 / 0.75;
const TRACK_RADIUS = 11 / 0.75;
const PILL_RADIUS = 8 / 0.75;
const ICON_GAP = 5 / 0.75;

const SEGMENTS: readonly { key: TailorChoice; label: string }[] = [
  { key: 'add', label: 'Add' },
  { key: 'skip', label: 'Skip' },
];

/**
 * The two-segment answer on each TAILOR 03 row. A white pill slides under the picked one: "✓ Add"
 * in brand when the keyword goes in, a plain dark "Skip" when it stays out. Fixed-width segments,
 * so the pill needs no measuring and sits in place on the first frame.
 */
export function AddSkipToggle({ keyword, value, onChange }: AddSkipToggleProps) {
  const { colors, shadows, s } = useTheme();
  const styles = useStyles();

  const index = value === 'add' ? 0 : 1;
  const pillStyle = useSlidingPill(index * s(SEGMENT_W));
  const { top, bottom } = hitSlopFor(s(SEGMENT_H));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={keyword}
      style={[styles.track, { backgroundColor: colors.surfaceSubtle }]}
    >
      <Animated.View
        style={[
          styles.pill,
          shadows.segmentPill,
          { backgroundColor: colors.surfaceCard },
          pillStyle,
        ]}
      />
      {SEGMENTS.map((segment) => {
        const selected = segment.key === value;
        const add = segment.key === 'add';
        return (
          <Pressable
            key={segment.key}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={`${segment.label} ${keyword}`}
            accessibilityState={{ selected }}
            feedback="subtle"
            haptic="none"
            hitSlop={{ top, bottom }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(segment.key);
            }}
            style={styles.segment}
          >
            {add && selected ? <Icon name="Check" size="xs" color={colors.brand} /> : null}
            <Text
              variant="captionSemiBold"
              color={selected ? (add ? 'brand' : 'textPrimary') : 'textSecondary'}
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

const useStyles = scaledSheet((s) => ({
  track: { flexDirection: 'row', padding: s(INSET), borderRadius: s(TRACK_RADIUS) },
  pill: {
    position: 'absolute',
    top: s(INSET),
    left: s(INSET),
    width: s(SEGMENT_W),
    height: s(SEGMENT_H),
    borderRadius: s(PILL_RADIUS),
  },
  segment: {
    width: s(SEGMENT_W),
    height: s(SEGMENT_H),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(ICON_GAP),
  },
}));
