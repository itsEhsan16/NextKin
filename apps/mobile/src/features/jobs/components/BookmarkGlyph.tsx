import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

export type BookmarkGlyphProps = {
  saved: boolean;
  size: number;
  color: string;
};

/**
 * The bookmark, which pops when a job is saved: the filled glyph springs up from
 * `scales.popFrom` on the bouncy spring (the motion spec's "bookmark fill"). Unsaving just
 * empties it — a removal does not celebrate — and nothing pops on mount.
 */
export function BookmarkGlyph({ saved, size, color }: BookmarkGlyphProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const wasSaved = useRef(saved);

  useEffect(() => {
    if (saved && !wasSaved.current && !reduced) {
      scale.set(
        withSequence(
          withTiming(motion.scales.popFrom, { duration: 0 }),
          withSpring(1, motion.springs.bouncy),
        ),
      );
    }
    wasSaved.current = saved;
  }, [motion.scales.popFrom, motion.springs.bouncy, reduced, saved, scale]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={popStyle}>
      <FontAwesome5 name="bookmark" size={size} color={color} solid={saved} />
    </Animated.View>
  );
}
