import { FadeIn, Keyframe, LinearTransition } from 'react-native-reanimated';

import { motion } from '@/theme';

/**
 * The one layout transition: things that move because something above them changed size (a chip
 * removed, a card deleted, a section expanding) glide on the `gentle` spring.
 *
 * `springify(duration)` sets the duration itself — chained the other way round, `.duration(x)`
 * before `.springify()`, the duration is silently dropped.
 */
const LAYOUT = LinearTransition.springify(motion.springs.gentle.duration).dampingRatio(
  motion.springs.gentle.dampingRatio,
);

/** The layout transition, or none under Reduce Motion. */
export const layoutTransition = (reduced: boolean) => (reduced ? undefined : LAYOUT);

/**
 * How an item leaves a list: it fades while shrinking to `scales.exit`, so a removal reads as the
 * item going away rather than blinking out. Pair it with `layoutTransition` on the siblings.
 */
const ITEM_EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: motion.scales.exit }] },
}).duration(motion.durations.fast);

/** The item exit, or none under Reduce Motion. */
export const itemExit = (reduced: boolean) => (reduced ? undefined : ITEM_EXIT);

/** An item joining a list after it has loaded (a filter widening): a quick fade, no stagger. */
const ITEM_ENTER = FadeIn.duration(motion.durations.fast);

/** The item entrance, or none under Reduce Motion. */
export const itemEnter = (reduced: boolean) => (reduced ? undefined : ITEM_ENTER);
