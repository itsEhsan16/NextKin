import { useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { JdQuote } from '@/data/models';
import { a11yButton, hitSlopFor, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';

/**
 * "Source" (toreview §153, mobile in §154): the job's own words a fact was read from, opened in
 * place. A fact said more than once shows every place it was said.
 */
export function JdSourceQuotes({ quotes, label }: { quotes: readonly JdQuote[]; label: string }) {
  const { colors, motion, sizes, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  if (quotes.length === 0) return null;

  return (
    <Animated.View layout={layoutTransition(reduced)} style={{ gap: spacing[2] }}>
      <Pressable
        {...a11yButton(
          open ? `Hide where the job says ${label}` : `Show where the job says ${label}`,
        )}
        accessibilityState={{ expanded: open }}
        feedback="subtle"
        hitSlop={hitSlopFor(sizes.iconSm)}
        onPress={() => setOpen((v) => !v)}
        style={{ alignSelf: 'flex-start' }}
      >
        <Text variant="captionSemiBold" color="brand">
          {open ? 'Hide source' : 'Source'}
        </Text>
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
          style={{ gap: spacing[1] }}
        >
          {quotes.map((q) => (
            <Text
              key={`${q.start}-${q.end}`}
              variant="micro"
              color="textSecondary"
              selectable
              style={{
                borderLeftWidth: sizes.borderThick,
                borderLeftColor: colors.brandBorder,
                paddingLeft: spacing[2],
                fontStyle: 'italic',
              }}
            >
              “{q.text}”
            </Text>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
