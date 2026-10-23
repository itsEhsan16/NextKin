import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

export type EdgeFadeProps = {
  /**
   * `top` hangs under a pinned header and fades downwards; `bottom` stands on a pinned bar and
   * fades upwards. Either way the page colour is solid at the pinned edge and clear away from it.
   */
  edge: 'top' | 'bottom';
  /**
   * The scroll offset, when the fade should only appear once something has actually scrolled
   * under the edge. Without it the fade is always drawn — right for a list whose own top padding
   * is deeper than the fade, so at rest it falls over bare page.
   */
  progress?: SharedValue<number>;
  /** The fade's depth at 390 when a place needs it shallower than the default 16. */
  heightAt390?: number;
};

/** Drawn at 390 — deep enough to read as a soft edge, shallow enough to cover no control. */
const FADE_AT390 = 16;

/** The default fade's depth in artboard units — what a reveal must clear above a pinned bar. */
export const EDGE_FADE_DEPTH = FADE_AT390 / 0.75;

/**
 * The soft edge where scrolling content passes under something pinned (owner, 2026-10-03: "should
 * not be blunt but blur type everywhere"). Content dissolves into the page instead of being sliced
 * off at the header's bottom line or the bar's top one.
 *
 * A gradient rather than a live blur: a blur needs a native view plus a mask to feather its own
 * edge, and both would cost a scrolling page on every frame. The fade gives the same dissolve.
 *
 * Drawn INSIDE its parent, pinned to the parent's top (`edge="top"`) or bottom edge — the parent
 * is the box the content scrolls in, and the fade is its last child so it paints over the content.
 * It used to hang outside the header box (`top: 100%`); Android clips children drawn outside their
 * parent, so the fade landed on the header itself and the content edge stayed hard.
 */
export function EdgeFade({ edge, progress, heightAt390 = FADE_AT390 }: EdgeFadeProps) {
  const { colors, s } = useTheme();
  const id = `fade${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const height = s(heightAt390 / 0.75);
  const solidAtTop = edge === 'top';

  const shown = useAnimatedStyle(() =>
    progress
      ? { opacity: interpolate(progress.value, [0, height], [0, 1], Extrapolation.CLAMP) }
      : { opacity: 1 },
  );

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fade, solidAtTop ? styles.below : styles.above, { height }, shown]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfacePage} stopOpacity={solidAtTop ? 1 : 0} />
            <Stop offset="0.5" stopColor={colors.surfacePage} stopOpacity={0.55} />
            <Stop offset="1" stopColor={colors.surfacePage} stopOpacity={solidAtTop ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0 },
  below: { top: 0 },
  above: { bottom: 0 },
});
