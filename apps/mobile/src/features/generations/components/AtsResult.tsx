import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  ATS_CHECK_LEDE,
  atsCheckTitle,
  SCORE_LABEL,
  SCORE_LABEL_CAPS,
  type AtsCheckResult,
} from '@/data/models';
// Deep imports on purpose: the resumes barrel drags its screens in.
import { ScoreBandPill } from '@/features/resumes/components/ScoreBandPill';
import { atsScoreColor } from '@/features/resumes/docMeta';
import { a11yButton, a11yHeader, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ScoreRing } from '@/ui/Progress';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

// ATS 03 at 390 (646:51), in artboard units.
const HERO_GAP = 14 / 0.75; // 646:56
const TEXT_GAP = 8 / 0.75; // 646:57
const LINK_TOP = 4 / 0.75; // 646:60
const LINK_PAD_X = 12 / 0.75; // 646:61
const LINK_PAD_Y = 7 / 0.75;
const LINK_GAP = 6 / 0.75;
const RING = 96 / 0.75; // 646:65
const RING_STROKE = 7.2 / 0.75; // TAILOR 02's ring in proportion (86 / 6.45)
const RING_TO_PILL = 8 / 0.75;
const HERO_TO_CARD = 20 / 0.75; // 646:72
const CARD_PAD = 15 / 0.75;
const HEAD_TO_SUB = 4 / 0.75; // 646:78
const SUB_TO_BODY = 12 / 0.75; // 646:80
const COUNT_PAD_X = 10 / 0.75; // 646:76
const COUNT_PAD_Y = 3 / 0.75;
const CHIP_GAP_X = 7 / 0.75; // 646:81
const CHIP_GAP_Y = 8 / 0.75;
const CHIP_PAD_X = 11 / 0.75; // 646:82
const CHIP_PAD_Y = 5 / 0.75;
const CARD_GAP = 14 / 0.75; // 646:90
const FIX_GAP = 8 / 0.75; // 646:105
const FIX_PAD_X = 12 / 0.75; // 646:98
const FIX_PAD_Y = 11 / 0.75;
const FIX_ROW_GAP = 12 / 0.75;
const FIX_RADIUS = 13 / 0.75;
const FIX_TILE = 32 / 0.75; // 646:100
const FIX_TILE_RADIUS = 9 / 0.75;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * How a verdict that landed while the user watched arrives (§85): the blocks rise in turn, and
 * the missing keywords appear one by one as if the check were still turning them up. `null` is a
 * result opened later, which simply shows.
 */
type Arrival = {
  block: (index: number) => FadeInDown | undefined;
  chip: (index: number) => FadeIn | undefined;
} | null;

const blockIn = (index: number) =>
  FadeInDown.delay(index * motion.stagger.card * 3).duration(motion.durations.base);
const chipIn = (index: number) =>
  FadeIn.delay(
    motion.stagger.card * 3 + Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
  ).duration(motion.durations.fast);

/** The verdict beside the ring (646:56): band and job, what that means, and how it is scored. */
function ResultHero({ result, onRubric }: { result: AtsCheckResult; onRubric: () => void }) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <Text variant="headlineLg" {...a11yHeader()}>
          {atsCheckTitle(result)}
        </Text>
        <Text variant="captionRegular" color="textSecondary">
          {ATS_CHECK_LEDE[result.band]}
        </Text>
        {/* §7.8: every score display links its rubric. */}
        <Pressable
          {...a11yButton(`How the ${SCORE_LABEL} works`)}
          feedback="scale"
          haptic="light"
          onPress={onRubric}
          style={[styles.link, { borderRadius: radii.full, backgroundColor: colors.brandSurface }]}
        >
          <Text variant="captionSemiBold" color="brand">
            {`How the ${SCORE_LABEL} works`}
          </Text>
          <Icon name="ChevronRight" size="sm" color={colors.brand} />
        </Pressable>
      </View>
      <View
        accessible
        accessibilityLabel={`${SCORE_LABEL} ${result.score} for this job`}
        style={styles.score}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ScoreRing
            score={result.score}
            label={SCORE_LABEL_CAPS}
            size={s(RING)}
            strokeWidth={s(RING_STROKE)}
            ringColor={atsScoreColor(result.score)}
            trackColor="borderDefault"
            numberVariant="scoreHero"
            numberColor="textPrimary"
            labelVariant="microOverline"
            labelColor="textSecondary"
          />
        </View>
        <ScoreBandPill band={result.band} />
      </View>
    </View>
  );
}

/** "Missing keywords" (646:73): what the job asks for that the resume does not show. */
function MissingCard({ missing, arrival }: { missing: readonly string[]; arrival: Arrival }) {
  const { colors, radii, sizes } = useTheme();
  const styles = useStyles();
  return (
    <Card radius="cardLg" style={styles.card}>
      <View style={styles.head}>
        <Text variant="title" style={styles.grow} {...a11yHeader()}>
          Missing keywords
        </Text>
        {missing.length > 0 ? (
          <View
            style={[
              styles.count,
              { borderRadius: radii.full, backgroundColor: colors.dangerSurface },
            ]}
          >
            <Text variant="microBadge" color="danger">
              {`${missing.length} missing`}
            </Text>
          </View>
        ) : null}
      </View>
      {/* §7.8 / D-14: a missing keyword is a gap to fill truthfully, never text to paste in. */}
      <Text variant="caption" color="textSecondary" style={styles.sub}>
        {missing.length > 0
          ? 'The job asks for these. Add only the ones you really have.'
          : 'Your resume already shows every keyword the job asks for.'}
      </Text>
      {missing.length > 0 ? (
        <View style={styles.chips}>
          {missing.map((keyword, index) => (
            <Animated.View
              key={keyword}
              entering={arrival?.chip(index)}
              style={[
                styles.chip,
                {
                  borderRadius: radii.full,
                  borderWidth: sizes.border,
                  backgroundColor: colors.warningSurface,
                  borderColor: colors.warningAccent,
                },
              ]}
            >
              <Text variant="microBadge" color="warningStrong">
                {keyword}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** "Fix these" (646:91): the most useful changes, numbered in the order to make them. */
function FixCard({ fixes }: { fixes: AtsCheckResult['fixes'] }) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  return (
    <Card radius="cardLg" style={styles.card}>
      <View style={styles.head}>
        <Text variant="title" style={styles.grow} {...a11yHeader()}>
          Fix these
        </Text>
        <Text variant="caption" color="textSecondary">
          {plural(fixes.length, 'fix', 'fixes')}
        </Text>
      </View>
      <Text variant="caption" color="textSecondary" style={styles.sub}>
        {fixes.length > 0
          ? 'Changes that make it read better for this job.'
          : 'Nothing in the layout or the bullets needs changing.'}
      </Text>
      <View style={styles.fixes}>
        {fixes.map((fix, index) => (
          <View
            key={fix.key}
            accessible
            accessibilityLabel={`${index + 1}. ${fix.title}. ${fix.detail}`}
            style={[styles.fix, { borderWidth: sizes.border, borderColor: colors.borderHairline }]}
          >
            <View style={[styles.tile, { backgroundColor: colors.brandSurface }]}>
              <Text variant="titleSm" color="brand">
                {String(index + 1)}
              </Text>
            </View>
            <View style={styles.grow}>
              <Text variant="label">{fix.title}</Text>
              <Text variant="caption" color="textSecondary">
                {fix.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

export type AtsResultProps = {
  result: AtsCheckResult;
  onRubric: () => void;
  /** The check finished while the user watched: play its arrival (see `Arrival`). */
  arrived?: boolean;
};

/** ATS 03 (646:51) under the ✕: the verdict and score, the missing keywords, the fixes. */
export function AtsResult({ result, onRubric, arrived = false }: AtsResultProps) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const arrival: Arrival = arrived && !reduced ? { block: blockIn, chip: chipIn } : null;
  return (
    <View>
      <Animated.View entering={arrival?.block(0)}>
        <ResultHero result={result} onRubric={onRubric} />
      </Animated.View>
      <View style={styles.cards}>
        <Animated.View entering={arrival?.block(1)}>
          <MissingCard missing={result.missing} arrival={arrival} />
        </Animated.View>
        <Animated.View entering={arrival?.block(2)}>
          <FixCard fixes={result.fixes} />
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: s(HERO_GAP) },
  heroText: { flex: 1, gap: s(TEXT_GAP) },
  link: {
    marginTop: s(LINK_TOP),
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(LINK_GAP),
    paddingHorizontal: s(LINK_PAD_X),
    paddingVertical: s(LINK_PAD_Y),
  },
  score: { alignItems: 'center', gap: s(RING_TO_PILL) },
  cards: { marginTop: s(HERO_TO_CARD), gap: s(CARD_GAP) },
  card: { padding: s(CARD_PAD) },
  head: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  count: { paddingHorizontal: s(COUNT_PAD_X), paddingVertical: s(COUNT_PAD_Y) },
  sub: { marginTop: s(HEAD_TO_SUB) },
  chips: {
    marginTop: s(SUB_TO_BODY),
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(CHIP_GAP_X),
    rowGap: s(CHIP_GAP_Y),
  },
  chip: { paddingHorizontal: s(CHIP_PAD_X), paddingVertical: s(CHIP_PAD_Y), borderStyle: 'dashed' },
  fixes: { marginTop: s(SUB_TO_BODY), gap: s(FIX_GAP) },
  fix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(FIX_ROW_GAP),
    paddingHorizontal: s(FIX_PAD_X),
    paddingVertical: s(FIX_PAD_Y),
    borderRadius: s(FIX_RADIUS),
  },
  tile: {
    width: s(FIX_TILE),
    height: s(FIX_TILE),
    borderRadius: s(FIX_TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
