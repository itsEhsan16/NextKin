import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { generationStepIndex, type Generation } from '@/data/models';
import { FlowHero, type FlowArt } from '@/features/create/components/FlowHero';
import type { LiveMotif } from '@/features/create/components/LiveArt';
import { formatPercent } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { AnimatedNumber, ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { TailorCheckRow, type TailorCheckState } from './TailorCheckRow';

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

// TAILOR 04 at 390 (608:204 / 608:214), in artboard units.
const HERO_TO_CARD = 22 / 0.75;
const CARD_PAD = 16 / 0.75;
const HEADER_GAP = 8 / 0.75;
const HEADER_TO_BAR = 10 / 0.75;
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;
const CARD_TO_NOTE = 14 / 0.75;

const LEDE = 'About a minute. Leave anytime — we will let you know when it is ready.';
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
export function TailorProgress({
  generation,
  company,
  title = company ? `Tailoring your resume for ${company}` : 'Tailoring your resume',
  lede = LEDE,
  cardTitle = 'Tailoring your resume',
  rows,
  footnote = FOOTNOTE,
  art,
  sparkle = true,
  motif = 'write',
}: TailorProgressProps) {
  const { s } = useTheme();
  const styles = useStyles();
  const percent = formatPercent(generation.progress);
  const working = generation.status !== 'ready';

  return (
    <View>
      <FlowHero title={title} lede={lede} art={art} motif={motif} active={working} />

      <Card radius="cardLg" style={styles.card}>
        <View
          accessible
          accessibilityLabel={`${cardTitle}, ${percent} complete`}
          style={styles.header}
        >
          {sparkle ? <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} /> : null}
          <Text variant="titleSm" style={styles.headerTitle} numberOfLines={1}>
            {cardTitle}
          </Text>
          <AnimatedNumber
            value={generation.progress * 100}
            timing="follow"
            memoryKey={`gen:${generation.id}:pct`}
            variant="title"
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
            trackColor="surfaceSubtle"
            timing="follow"
            memoryKey={`gen:${generation.id}:bar`}
            live={working}
          />
        </View>
        {(rows ?? tailorProgressRows(generation)).map((row) => (
          <TailorCheckRow key={row.label} label={row.label} state={row.state} />
        ))}
      </Card>

      {footnote ? (
        <Text variant="caption" color="textTertiary" align="center" style={styles.note}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { marginTop: s(HERO_TO_CARD), padding: s(CARD_PAD) },
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  headerTitle: { flex: 1 },
  bar: { marginVertical: s(HEADER_TO_BAR) },
  note: { marginTop: s(CARD_TO_NOTE) },
}));
