import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Screen, Text } from '@/ui';
import {
  DevSection,
  MeterDemo,
  PressScaleDemo,
  SegmentedPillDemo,
  SheetFabDemo,
  StaggerDemo,
} from '@/ui/dev';

export default function MotionRoute() {
  const { motion } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Screen scroll edges={[]}>
      {reduced ? (
        <Text variant="caption" color="warning">
          Reduce Motion is on: decorative animations collapse to instant.
        </Text>
      ) : null}

      <DevSection
        title="Sheet + FAB morph"
        description={`springs.sheetIn (${motion.durations.sheetIn}ms, ζ ${motion.springs.sheetIn.dampingRatio}) in · timings.sheetOut (${motion.durations.sheetOut}ms) out · glyph rotates ${motion.sheet.fabRotationOpenDeg}°`}
      >
        <SheetFabDemo />
      </DevSection>

      <DevSection
        title="Stagger"
        description={`FadeInDown, ${motion.stagger.row}ms apart, ${motion.durations.base}ms each`}
      >
        <StaggerDemo />
      </DevSection>

      <DevSection
        title="Press scale"
        description={`scale ${motion.scales.pressed} over timings.press (${motion.durations.press}ms) + light haptic`}
      >
        <PressScaleDemo />
      </DevSection>

      <DevSection
        title="Segmented pill"
        description={`springs.snappy (${motion.durations.snappy}ms, critically damped)`}
      >
        <SegmentedPillDemo />
      </DevSection>

      <DevSection
        title="Meter"
        description={`timings.meter (${motion.durations.meter}ms, decelerate) with a UI-thread count-up label`}
      >
        <MeterDemo />
      </DevSection>
    </Screen>
  );
}
