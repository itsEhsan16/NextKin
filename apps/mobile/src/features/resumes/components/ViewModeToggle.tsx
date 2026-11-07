import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { useSlidingPill } from '@/ui/motion';

import type { ResumesViewMode } from '../resumesStore';
import { Icon, type LineIconName } from '@/ui/Icon';

export type ViewModeToggleProps = {
  value: ResumesViewMode;
  onChange: (mode: ResumesViewMode) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Figma 1:1374 — 104×52 track, 4pt inset, 48×44 white pill sliding between two icon cells.
 *
 * The height is `sizes.filterButton`, not a flat `s(52)`: the board draws the toggle the height
 * of the search field beside it, and the field (like Jobs' filter button) holds at the 44pt
 * control floor on a phone. Flat-scaled, the toggle was 39 next to a 46 field (toreview.md 54).
 */
const TRACK_WIDTH = 104;
const INSET = 4;
const CELL = (TRACK_WIDTH - INSET * 2) / 2;

const MODES: readonly { key: ResumesViewMode; icon: LineIconName; label: string }[] = [
  { key: 'grid', icon: 'Grid01', label: 'Grid view' },
  { key: 'list', icon: 'List', label: 'List view' },
];

/**
 * Grid ⇄ list switch. A miniature of SegmentedControl (which is label-only) on the same
 * sliding pill; two fixed cells keep the geometry static so no measuring pass is needed.
 */
export function ViewModeToggle({ value, onChange, style }: ViewModeToggleProps) {
  const { colors, radii, shadows, sizes, s } = useTheme();

  const index = value === 'grid' ? 0 : 1;
  // Device space, like the track and pill they position. The raw artboard form put the pill
  // 13dp past its cell at 390 and hung it outside the track entirely.
  const inset = s(INSET);
  const cell = s(CELL);
  const pillStyle = useSlidingPill(inset + index * cell);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          width: s(TRACK_WIDTH),
          height: sizes.filterButton,
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
            top: s(INSET),
            width: s(CELL),
            height: sizes.filterButton - 2 * inset,
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
            feedback="subtle"
            onPress={() => {
              if (selected) return;
              onChange(mode.key);
            }}
            style={styles.cell}
          >
            <Icon
              name={mode.icon}
              size="sm"
              color={selected ? colors.textPrimary : colors.iconMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  // `top` is set inline from s(INSET) — a raw artboard length here would not scale.
  pill: { position: 'absolute', left: 0 },
  cell: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
