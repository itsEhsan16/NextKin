import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import type { Generation } from '@/data/models';
import { FLOW_ART, FlowHero } from '@/features/create/components/FlowHero';
import { formatPercent } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { AnimatedNumber, ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import {
  COVER_CARD_TITLE,
  COVER_HONESTY_NOTE,
  COVER_WRITING_TITLE,
  coverProgressRows,
  coverWritingLede,
} from './coverRun';
import { TailorCheckRow } from './TailorCheckRow';

// COVER 02 at 390 (644:115), in artboard units.
const HERO_TO_CARD = 22 / 0.75; // 644:114
const CARD_PAD = 15 / 0.75;
const HEAD_TO_BAR = 10 / 0.75; // 644:119
const BAR_TO_ROWS = 8 / 0.75; // 644:122
const ROWS_TO_NOTE = 10 / 0.75; // 644:143
const NOTE_PAD_X = 12 / 0.75; // 644:144
const NOTE_PAD_Y = 10 / 0.75;
const NOTE_GAP = 10 / 0.75;
const NOTE_RADIUS = 10 / 0.75;
const NOTE_GLYPH = 14 / 0.75;

const percentLabel = (n: number) => {
  'worklet';
  return `${Math.round(n)}%`;
};

/**
 * COVER 02 (644:84) under the stepper: the writing robot, the hero, and the live checklist card
 * — its head and meter, the five steps, and the honesty note that closes it. The run keeps going
 * if the reader leaves; the ✕ above says so by taking them back, and the notification follows.
 */
export function CoverProgress({ generation }: { generation: Generation }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const percent = formatPercent(generation.progress);

  return (
    <View>
      <FlowHero
        title={COVER_WRITING_TITLE}
        lede={coverWritingLede(generation.jobId != null)}
        art={FLOW_ART.coverWriting}
        // The robot's page takes ink line by line while the letter is written.
        motif="write"
        active={generation.status !== 'ready'}
      />

      <Card radius="cardLg" style={styles.card}>
        <View
          accessible
          accessibilityLabel={`${COVER_CARD_TITLE}, ${percent} complete`}
          style={styles.head}
        >
          <Text variant="titleSm" style={styles.headTitle} numberOfLines={1}>
            {COVER_CARD_TITLE}
          </Text>
          <AnimatedNumber
            value={generation.progress * 100}
            timing="follow"
            memoryKey={`gen:${generation.id}:pct`}
            variant="titleSm"
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
            live={generation.status !== 'ready'}
          />
        </View>
        {coverProgressRows(generation).map((row) => (
          <TailorCheckRow key={row.label} label={row.label} state={row.state} />
        ))}
        <View accessible style={[styles.note, { backgroundColor: colors.brandSurface }]}>
          <FontAwesome5 name="lightbulb" size={s(NOTE_GLYPH)} color={colors.glyphNote} solid />
          <Text variant="micro" color="textBody" style={styles.noteText}>
            {COVER_HONESTY_NOTE}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { marginTop: s(HERO_TO_CARD), padding: s(CARD_PAD) },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTitle: { flex: 1 },
  bar: { marginTop: s(HEAD_TO_BAR), marginBottom: s(BAR_TO_ROWS) },
  note: {
    marginTop: s(ROWS_TO_NOTE),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(NOTE_GAP),
    paddingHorizontal: s(NOTE_PAD_X),
    paddingVertical: s(NOTE_PAD_Y),
    borderRadius: s(NOTE_RADIUS),
  },
  noteText: { flex: 1 },
}));
