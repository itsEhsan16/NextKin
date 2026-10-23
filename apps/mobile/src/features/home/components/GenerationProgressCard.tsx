import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import {
  GENERATION_STEPS,
  generationHint,
  generationStepIndex,
  type Generation,
  type GenerationStep,
} from '@/data/models';
import { a11yButton, formatPercent, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { AnimatedNumber, ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type GenerationProgressCardProps = {
  generation: Generation;
  onView: () => void;
  onRetry: () => void;
};

const TILE = 44;

const stepFor = (generation: Generation): GenerationStep | undefined =>
  GENERATION_STEPS[generationStepIndex(generation.status)];

const percentLabel = (n: number) => {
  'worklet';
  return `${Math.round(n)}%`;
};

/**
 * What the card calls the run, in its own words: a cover letter is not "Tailoring your resume",
 * and neither is an ATS check (the card used to say that for every kind).
 */
export function runHeadline(generation: Generation, failed: boolean): string {
  if (generation.kind === 'cover_letter') {
    return failed ? "Couldn't finish your cover letter" : 'Writing your cover letter';
  }
  if (generation.kind === 'ats_check') {
    return failed ? "Couldn't finish your ATS check" : 'Checking your resume';
  }
  if (generation.kind === 'interview') {
    return failed ? "Couldn't write your questions" : 'Writing your interview questions';
  }
  if (generation.kind === 'zero_resume') {
    return failed ? "Couldn't finish your draft" : 'Writing your first draft';
  }
  if (generation.origin === 'build') {
    return failed ? "Couldn't finish your resume" : 'Building your resume';
  }
  return failed ? "Couldn't finish your resume" : 'Tailoring your resume';
}

/**
 * Live progress for an in-flight resume generation (V2 §7.6's queued → generating → validating →
 * scoring pipeline).
 *
 * NOTE: this is the one piece of Home with no artboard — Figma has not designed the generation
 * flow, and DESIGN 2 draws the idle state. It is therefore built strictly from existing
 * primitives and tokens, and it only exists while a generation is actually running, so it never
 * contradicts the artboard. Replace it wholesale when the flow is designed.
 */
export function GenerationProgressCard({
  generation,
  onView,
  onRetry,
}: GenerationProgressCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const failed = generation.status === 'failed';
  const step = stepFor(generation);

  const headline = runHeadline(generation, failed);
  const detail = failed
    ? (generation.error ?? 'Something went wrong. Try again.')
    : generationHint(generation);

  return (
    <Card shadow="card" style={{ gap: spacing[3] }}>
      {/* One summary stop for the status; the action below stays its own element, so a screen
          reader never loses the only way to act on a failure. */}
      <View
        accessible
        accessibilityLabel={
          failed
            ? `${headline}. ${detail}`
            : `${headline}. ${step?.label ?? ''}, ${formatPercent(generation.progress)} complete.`
        }
        style={[styles.row, { gap: spacing[3] }]}
      >
        <View
          style={[
            styles.tile,
            {
              width: s(TILE),
              height: s(TILE),
              borderRadius: radii.lg,
              backgroundColor: failed ? colors.dangerSurface : colors.brandSurface,
            },
          ]}
        >
          <FontAwesome5
            name={failed ? 'exclamation-triangle' : 'magic'}
            size={s(17)}
            color={failed ? colors.danger : colors.brand}
            solid
          />
        </View>
        <View style={styles.copy}>
          <Text variant="title" numberOfLines={1}>
            {headline}
          </Text>
          <Text variant="jobMeta" color="textSecondary" numberOfLines={2}>
            {detail}
          </Text>
        </View>
        {failed ? null : (
          // Counts with the bar, from the same beat and the same memory as the run screen's, so
          // opening the run continues the number instead of jumping it.
          <AnimatedNumber
            value={generation.progress * 100}
            timing="follow"
            memoryKey={`gen:${generation.id}:pct`}
            variant="captionSemiBold"
            color="textSecondary"
            format={percentLabel}
          />
        )}
      </View>

      {failed ? null : (
        // The row above already announces the percentage, so the meter is decorative here.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ProgressBar
            value={generation.progress}
            fillColor="brand"
            // Live: glides between the run's ticks, and the run screen continues from here.
            timing="follow"
            memoryKey={`gen:${generation.id}:bar`}
            live
          />
        </View>
      )}

      {/* Not "View resume": while this card is on screen the run is unfinished, and the link goes
          to the run's own progress screen (§7.6), not to a document that does not exist yet. */}
      <Pressable
        {...a11yButton(failed ? 'Try again' : 'View progress')}
        feedback="subtle"
        haptic="selection"
        hitSlop={hitSlop8}
        onPress={failed ? onRetry : onView}
        style={styles.link}
      >
        <Text variant="captionSemiBold" color={failed ? 'danger' : 'link'}>
          {failed ? 'Try again' : 'View progress'}
        </Text>
      </Pressable>
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: s(2) },
  link: { alignSelf: 'flex-start' },
}));
