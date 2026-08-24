import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import {
  GENERATION_STEPS,
  generationStepIndex,
  type Generation,
  type GenerationStep,
} from '@/data/models';
import { a11yButton, formatPercent, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type GenerationProgressCardProps = {
  generation: Generation;
  onView: () => void;
  onRetry: () => void;
};

const TILE = 44;

const stepFor = (generation: Generation): GenerationStep | undefined =>
  GENERATION_STEPS[generationStepIndex(generation.status)];

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
  const { colors, radii, spacing } = useTheme();
  const failed = generation.status === 'failed';
  const step = stepFor(generation);

  const headline = failed ? "Couldn't finish your resume" : 'Tailoring your resume';
  const detail = failed
    ? (generation.error ?? 'Something went wrong. Try again.')
    : (step?.hint ?? '');

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
              width: TILE,
              height: TILE,
              borderRadius: radii.lg,
              backgroundColor: failed ? colors.dangerSurface : colors.brandSurface,
            },
          ]}
        >
          <FontAwesome5
            name={failed ? 'exclamation-triangle' : 'magic'}
            size={17}
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
          <Text variant="captionSemiBold" color="textSecondary">
            {formatPercent(generation.progress)}
          </Text>
        )}
      </View>

      {failed ? null : (
        // The row above already announces the percentage, so the meter is decorative here.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ProgressBar value={generation.progress} fillColor="brand" />
        </View>
      )}

      <Pressable
        {...a11yButton(failed ? 'Try again' : 'View resume')}
        feedback="subtle"
        haptic="selection"
        hitSlop={hitSlop8}
        onPress={failed ? onRetry : onView}
        style={styles.link}
      >
        <Text variant="captionSemiBold" color={failed ? 'danger' : 'link'}>
          {failed ? 'Try again' : 'View resume'}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  link: { alignSelf: 'flex-start' },
});
