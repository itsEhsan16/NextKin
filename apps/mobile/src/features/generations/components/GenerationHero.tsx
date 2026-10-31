import { View } from 'react-native';

import {
  generationHint,
  generationStepIndex,
  GENERATION_STEPS,
  SCORE_LABEL,
  SCORE_LABEL_CAPS,
  type Generation,
} from '@/data/models';
import { atsScoreColor } from '@/features/resumes';
import { formatPercent } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { AnimatedNumber, ProgressBar, ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';
import { Reveal, SuccessMark, useBecameTrue } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

export type GenerationHeroProps = {
  generation: Generation;
  /** The finished document's ATS score, when this run produced one. */
  score?: number;
};

const TILE = 44;
const RING = 132;
const RING_STROKE = 10;

const percentLabel = (n: number) => {
  'worklet';
  return `${Math.round(n)}%`;
};

/**
 * The top of the progress screen (V2 §7.6): a live meter while the pipeline runs, and the score
 * the run landed on once it is ready.
 */
export function GenerationHero(props: GenerationHeroProps) {
  const ready = props.generation.status === 'ready';
  const scored = ready && props.score != null;
  // Celebrate only a run that finished while the user watched; a revisit shows the tick at
  // rest. Read here, above the Reveal: the body remounts with each state, so it can't tell.
  const justFinished = useBecameTrue(ready);
  // The meter fades into the result rather than cutting to it (§85).
  return (
    <Reveal stateKey={scored ? 'scored' : ready ? 'ready' : 'running'}>
      <HeroBody {...props} justFinished={justFinished} />
    </Reveal>
  );
}

function HeroBody({
  generation,
  score,
  justFinished,
}: GenerationHeroProps & { justFinished: boolean }) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const hint = generationHint(generation);
  const ready = generation.status === 'ready';

  if (ready && score != null) {
    return (
      <Card shadow="card" style={[styles.centre, { gap: spacing[4], paddingVertical: spacing[6] }]}>
        <ScoreRing
          score={score}
          label={SCORE_LABEL_CAPS}
          size={s(RING)}
          strokeWidth={s(RING_STROKE)}
          ringColor={atsScoreColor(score)}
          trackColor="surfaceSubtle"
          numberVariant="scoreHero"
          numberColor="textPrimary"
          labelVariant="microOverline"
          labelColor="textSecondary"
          accessibilityLabel={`${SCORE_LABEL} ${score}`}
        />
        <Text variant="title" align="center">
          {hint}
        </Text>
      </Card>
    );
  }

  if (ready) {
    // Nothing to score — a cover letter or a question set. The run still has to land somewhere
    // that says so, rather than leaving the meter sitting at 100%.
    return (
      <Card shadow="card" style={[styles.row, { gap: spacing[3] }]}>
        <SuccessMark size={s(TILE)} variant="tile" radius={radii.lg} animate={justFinished} />
        <Text variant="title" style={styles.copy}>
          {hint}
        </Text>
      </Card>
    );
  }

  const step = GENERATION_STEPS[generationStepIndex(generation.status)];
  const meterLabel = `${step?.label ?? 'Working'}, ${formatPercent(generation.progress)} complete`;

  return (
    <Card shadow="card" style={{ gap: spacing[4] }}>
      {/* One summary stop for the whole meter; the steps below announce themselves separately. */}
      <View accessible accessibilityLabel={meterLabel} style={[styles.row, { gap: spacing[3] }]}>
        <View
          style={[
            styles.tile,
            {
              width: s(TILE),
              height: s(TILE),
              borderRadius: radii.lg,
              backgroundColor: colors.brandSurface,
            },
          ]}
        >
          <Icon name="Stars02" size="sm" color={colors.brand} />
        </View>
        <Text variant="title" style={styles.copy} numberOfLines={1}>
          {step?.label ?? ''}
        </Text>
        <AnimatedNumber
          value={generation.progress * 100}
          timing="follow"
          memoryKey={`gen:${generation.id}:pct`}
          variant="display"
          color="textPrimary"
          format={percentLabel}
        />
      </View>

      {/* The row above already gives the number, so the meter itself is decorative. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProgressBar
          value={generation.progress}
          fillColor="brand"
          timing="follow"
          memoryKey={`gen:${generation.id}:bar`}
          live
        />
      </View>
      {/* No hint line here: the step list below carries it on the row it belongs to, and printing
          it in both places says the same sentence twice — once on screen, once to a reader. */}
    </Card>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  centre: { alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
}));
