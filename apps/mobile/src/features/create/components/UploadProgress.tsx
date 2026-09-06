import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type UploadProgressProps = {
  /** The file being read, so the page names what it is working on. */
  fileName: string;
};

/**
 * The ticks a parse passes, and how far along each one is. The last stops short of full: the run
 * ends when the response lands, not when this bar reaches the end, and a bar sitting at 100% while
 * nothing else happened would be a lie about where the work is.
 */
const TICKS = [
  { label: 'Reading the file', value: 0.2 },
  { label: 'Finding your roles', value: 0.5 },
  { label: 'Reading your skills', value: 0.75 },
  { label: 'Nearly there', value: 0.9 },
] as const;

const LAST = TICKS.length - 1;
const ICON = 12;

/**
 * What an upload looks like while it is being parsed (V2 §7.4). The mock takes 1200–2200ms and a
 * real parse will not be quicker, so the wait is given a shape: named ticks over a bar that
 * advances, rather than a spinner that says nothing.
 *
 * The steps are paced by a Reanimated clock rather than a JS interval — one worklet timing over
 * `motion.durations.meter` per tick, so the pacing is a motion token like every other animation
 * in the app, and nothing is scheduled on the JS thread that a fast response has to tear down.
 */
export function UploadProgress({ fileName }: UploadProgressProps) {
  const { colors, motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  // Counts 0 → LAST in tick-space; `Math.floor` of it is the tick on screen.
  const clock = useSharedValue(0);

  useEffect(() => {
    // Reduced motion gets no clock at all: the ticks are pacing, and pacing collapsed to an
    // instant would jump the reader to "Nearly there" while the parse had barely started.
    if (reduced) return;
    clock.set(
      withTiming(LAST, {
        duration: motion.durations.meter * LAST,
        easing: motion.easings.linear,
      }),
    );
  }, [clock, motion.durations.meter, motion.easings.linear, reduced]);

  useAnimatedReaction(
    () => Math.min(LAST, Math.floor(clock.get())),
    (current, previous) => {
      if (current !== previous) runOnJS(setStep)(current);
    },
  );

  const tick = TICKS[step] ?? TICKS[0];

  return (
    <Card radius="card">
      <View style={{ gap: spacing[4] }}>
        <View style={{ gap: spacing[1] }}>
          <Text variant="title" numberOfLines={2}>
            {fileName}
          </Text>
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            {tick.label}
          </Text>
        </View>

        <ProgressBar value={tick.value} accessibilityLabel={`Parsing, ${tick.label}`} />

        {/* The live line above already says where the parse is; the list repeating it would be a
            second stop that adds nothing. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ gap: spacing[2] }}
        >
          {TICKS.map((entry, index) => (
            <View
              key={entry.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}
            >
              <FontAwesome5
                name={index < step ? 'check' : 'circle'}
                size={s(ICON)}
                color={index <= step ? colors.iconDefault : colors.iconChevron}
                solid={index < step}
              />
              <Text variant="rowDescription" color={index <= step ? 'textPrimary' : 'textTertiary'}>
                {entry.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
