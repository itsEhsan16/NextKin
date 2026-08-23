import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { a11yButton } from '@/lib';
import { useTabBarLayout, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

import { useCreateSheet } from './createSheet';

/**
 * The centre "+" button. Sits above the tab pill AND above the create sheet's scrim so the
 * rotated "✕" stays the visible dismiss affordance (Figma motion note). The glyph rotation is
 * driven by the sheet's own progress value — no separate timer, so it can't drift.
 */
export function Fab() {
  const { colors, radii, shadows, motion } = useTheme();
  const layout = useTabBarLayout();
  const { progress, isOpen, toggle } = useCreateSheet();

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, motion.sheet.fabRotationOpenDeg])}deg` },
    ],
  }));

  return (
    <Pressable
      {...a11yButton(isOpen ? 'Close create menu' : 'Create')}
      accessibilityState={{ expanded: isOpen }}
      feedback="scale"
      haptic="none"
      onPress={toggle}
      style={[
        styles.fab,
        shadows.fab,
        {
          width: layout.fabSize,
          height: layout.fabSize,
          borderRadius: radii.full,
          bottom: layout.fabBottom,
          backgroundColor: colors.fabFill,
        },
      ]}
    >
      <Animated.View style={glyphStyle}>
        <FontAwesome5 name="plus" size={Math.round(layout.fabSize * 0.37)} color={colors.fabGlyph} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
