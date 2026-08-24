import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

const SHEET_HEIGHT = 200;
const STAGE_HEIGHT = 280;
const FAB_ICON_SIZE = 22;

/**
 * (a) + (b): the sheet, the scrim and the FAB glyph are all driven by ONE `progress` shared
 * value (0 = closed, 1 = open) so they can never drift out of sync. This is the exact
 * contract `sheetProgress` will have in Phase 2.
 */
export function SheetFabDemo() {
  const { colors, spacing, radii, sizes, shadows, motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      haptics.light();
      progress.value = withSpring(1, withReducedMotion(reduced, motion.springs.sheetIn));
    } else {
      progress.value = withTiming(0, withReducedMotion(reduced, motion.timings.sheetOut));
    }
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [SHEET_HEIGHT, 0]) }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(progress.value, [0, 1], [0, motion.sheet.fabRotationOpenDeg])}deg`,
      },
    ],
  }));

  return (
    <View
      style={[
        styles.stage,
        {
          height: s(STAGE_HEIGHT),
          borderRadius: radii.card,
          backgroundColor: colors.surfaceSubtle,
          borderColor: colors.borderHairline,
        },
      ]}
    >
      <View style={{ padding: spacing[4] }}>
        <Text variant="caption" color="textSecondary">
          Page content behind the sheet
        </Text>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}
      />

      <Animated.View
        style={[
          styles.sheet,
          {
            height: s(SHEET_HEIGHT),
            backgroundColor: colors.surfaceSheet,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            padding: spacing[5],
            gap: spacing[2],
          },
          shadows.sheet,
          sheetStyle,
        ]}
      >
        <View
          style={[
            styles.handle,
            {
              width: sizes.grabHandleWidth,
              height: sizes.grabHandleHeight,
              borderRadius: radii.full,
              backgroundColor: colors.grabHandle,
            },
          ]}
        />
        <Text variant="headline">Create</Text>
        <Text variant="body" color="textSecondary">
          springs.sheetIn on open, timings.sheetOut on close.
        </Text>
      </Animated.View>

      <Pressable
        {...a11yButton(open ? 'Close sheet' : 'Open sheet')}
        onPress={toggle}
        style={[
          styles.fab,
          {
            width: sizes.fab,
            height: sizes.fab,
            borderRadius: radii.full,
            backgroundColor: colors.fabFill,
            bottom: spacing[4],
          },
          shadows.fab,
        ]}
      >
        <Animated.View style={glyphStyle}>
          <FontAwesome5 name="plus" size={s(FAB_ICON_SIZE)} color={colors.fabGlyph} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  stage: { overflow: 'hidden', borderWidth: s(1) },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  handle: { alignSelf: 'center' },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
