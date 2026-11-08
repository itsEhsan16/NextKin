import { View } from 'react-native';

import { Image } from 'expo-image';

import { generationStepIndex, type Generation } from '@/data/models';
import type { FlowArt } from '@/features/create/components/FlowHero';
import type { LiveMotif } from '@/features/create/components/LiveArt';
import { FlowCard } from '@/features/create/flow/FlowKit';
import { formatPercent } from '@/lib';
import { motion, scaledSheet } from '@/theme';
import { AnimatedNumber, ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { TailorCheckRow, type TailorCheckState } from './TailorCheckRow';

const ILLUSTRATION = require('../../../../assets/illustrations/redesign/job-match.webp');

export type TailorProgressProps = {
  generation: Generation;
  /** The employer, once the job has loaded — "Tailoring your resume for Stripe". */
  company?: string;
  /**
   * Another flow's words and checklist on the same layout (COVER 02 613:1531). Each falls back
   * to Tailor's own, so TAILOR 04 passes none of them.
   */
  title?: string;
  lede?: string;
  cardTitle?: string;
  rows?: readonly TailorProgressRow[];
  /** Null drops the line under the card (ATS 02 646:2 draws none). */
  footnote?: string | null;
  /** The board's drawing above the title (ZERO 02 661:14). */
  art?: FlowArt;
  /** The sparkle before the card title; ATS 02 draws the title alone (646:18). */
  sparkle?: boolean;
  /**
   * What the drawing does while the run works: `write` (the default) for a page being written,
   * `scan` for one being analysed (ATS 02).
   */
  motif?: LiveMotif;
};

export type TailorProgressRow = { label: string; state: TailorCheckState };

const LEDE = 'About a minute. Leave anytime.';
const FOOTNOTE = 'Only from your resume and your answers. Nothing is invented.';

const percentLabel = (n: number) => {
  'worklet';
  return `${Math.round(n)}%`;
};

const skillsLabel = (count: number) =>
  `Added the ${count} skill${count === 1 ? '' : 's'} you chose`;

/**
 * TAILOR 04's checklist, read off the pipeline's status. The comparison was made before the run
 * started, and the chosen skills go in with the first draft, so both are behind a run that is
 * generating; the skills row exists only when the user said yes to something.
 */
export function tailorProgressRows(generation: Generation): TailorProgressRow[] {
  const added = generation.tailor?.added.length ?? 0;
  const labels = [
    'Compared it with the job',
    ...(added > 0 ? [skillsLabel(added)] : []),
    'Rewriting your headline and summary',
    'Checking the ATS score',
  ];
  const last = labels.length - 1;
  // queued → the comparison row; generating → the rewrite; validating and scoring → the check.
  const step = generationStepIndex(generation.status);
  const current =
    generation.status === 'ready' ? labels.length : step <= 0 ? 0 : step === 1 ? last - 1 : last;
  return labels.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}

/** TAILOR 04 (608:196) below the stepper: the hero copy, the live checklist card, the footnote. */
/**
 * Every run's progress screen (toreview §173, Figma "Build · 3 Building"): the illustration, a
 * centred title and one line, then a card with the live percent, a bar and the steps. Tailor,
 * Build, Zero and ATS all draw it; each passes its own words and rows.
 */
export function TailorProgress({
  generation,
  company,
  title = company ? `Tailoring for ${company}` : 'Tailoring your resume',
  lede = LEDE,
  cardTitle = 'Writing your resume',
  rows,
  footnote = FOOTNOTE,
}: TailorProgressProps) {
  const styles = useStyles();
  const percent = formatPercent(generation.progress);
  const working = generation.status !== 'ready';

  return (
    <View style={styles.wrap}>
      <Image
        source={ILLUSTRATION}
        style={styles.art}
        contentFit="contain"
        accessible={false}
        cachePolicy="memory"
        transition={motion.durations.imageFade}
      />
      <View style={styles.titleBlock}>
        <Text variant="title1" color="ink" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodyLg" color="textSecondary" align="center">
          {lede}
        </Text>
      </View>

      <FlowCard style={styles.card}>
        <View
          accessible
          accessibilityLabel={`${cardTitle}, ${percent} complete`}
          style={styles.header}
        >
          <Text variant="title3" color="ink" style={styles.headerTitle}>
            {cardTitle}
          </Text>
          <AnimatedNumber
            value={generation.progress * 100}
            timing="follow"
            memoryKey={`gen:${generation.id}:pct`}
            variant="bodyLgStrong"
            color="brand"
            format={percentLabel}
          />
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.bar}
        >
          <ProgressBar
            value={generation.progress}
            fillColor="brand"
            trackColor="progressTrack"
            timing="follow"
            memoryKey={`gen:${generation.id}:bar`}
            live={working}
          />
        </View>
        {(rows ?? tailorProgressRows(generation)).map((row) => (
          <TailorCheckRow key={row.label} label={row.label} state={row.state} />
        ))}
      </FlowCard>

      {footnote ? (
        <Text variant="footnote" color="textTertiary" align="center">
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(20), paddingTop: u(12) },
  art: { width: u(170), height: u(170), alignSelf: 'center' },
  titleBlock: { gap: u(6) },
  card: { gap: u(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  headerTitle: { flex: 1 },
  bar: { marginTop: u(8), marginBottom: u(8) },
}));
