import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FixSparkleIcon from '../../../../assets/icons/score/fix-sparkle.svg';
import { ATS_BAND_LABEL, atsQuickWins, SCORE_LABEL } from '@/data/models';
import { useResume, useResumeScore } from '@/data/queries';
import { a11yButton, a11yHeader, hitSlopFor, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { ScoreBandPill } from '../components/ScoreBandPill';
import { ScoreSection } from '../components/ScoreSection';
import { atsBandColor, scoreContextLine } from '../docMeta';
import { useResumesActions } from '../hooks/useResumesActions';

export type ResumeScoreScreenProps = { id: string };

const RING = 132;
const RING_STROKE = 10;
/**
 * Vertical rhythm on the 390 board (95:2310), in artboard units: back button → ring 28 (37),
 * ring → band pill 22 (29), pill → summary 18.5 (25), summary → context 8 (11), context →
 * divider 22 (29), divider → first heading 24 (32), sections 31.25 apart (42) and the same
 * again down to the recalc line.
 */
const RING_TOP = 37;
const PILL_TOP = 29;
const SUMMARY_TOP = 25;
const CONTEXT_TOP = 11;
const DIVIDER_TOP = 29;
const DIVIDER_BOTTOM = 32;
const SECTION_GAP = 42;
/** The summary wraps inside 330 at 390 (95:2321). */
const SUMMARY_WIDTH = 440;
/** The CTA's sparkle (529:19) is drawn 23.99 × 24.83, 4 short of its label, at 390. */
const CTA_SPARKLE = { w: 23.99 / 0.75, h: 24.83 / 0.75 } as const;
const CTA_GAP = 4 / 0.75;
const RECALC_ICON = 10 / 0.75;
/** The rubric link is one `captionSemiBold` line; `hitSlopFor` pads it out to the 44pt floor. */
const LINK_HEIGHT = 20;
/** Skeleton bars standing in for the context line (captionSm) and that link. */
const CONTEXT_SKELETON = 200;
const LINK_SKELETON = 160;

/**
 * RESUMES 04 — ATS score panel (Figma 95:2310). Pushed from a card's ATS badge. The back row is
 * pinned above the scroller, and so is the "Fix N quick wins" bar below it, which disappears
 * once nothing is left to fix. The bar's CTA is `sizes.buttonLg`, the height of every other
 * sticky CTA in the app — a flat `s(56)` put it at 42 on a phone, under the 44pt floor.
 */
export function ResumeScoreScreen({ id }: ResumeScoreScreenProps) {
  const { colors, radii, shadows, sizes, spacing, zIndex, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const actions = useResumesActions();

  const resume = useResume(id);
  const score = useResumeScore(id);
  // Rows rise in only when the score replaces its skeleton; a cached revisit shows them at rest.
  const enter = useRevealStagger(!(resume.isPending || score.isPending), 'row');

  const body = (children: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: colors.surfacePage, paddingTop: insets.top }]}>
      <View
        style={[
          styles.headerRow,
          { paddingHorizontal: spacing.gutter, paddingTop: spacing.headerTopPushed },
        ]}
      >
        <IconButton icon="chevron-left" label="Back" onPress={actions.goBack} />
        <Text {...a11yHeader()} variant="scoreTitle" style={styles.headerTitle} align="center">
          ATS score
        </Text>
        {/* Mirrors the back button so the centred title stays centred. */}
        <View style={{ width: sizes.iconButton }} />
      </View>
      {children}
    </View>
  );

  if (resume.isPending || score.isPending) {
    return body(
      <View style={{ padding: spacing.gutter, gap: spacing[4], alignItems: 'center' }}>
        <Skeleton
          width={s(RING)}
          height={s(RING)}
          radius="full"
          style={{ marginTop: spacing[4] }}
        />
        <Skeleton width={s(120)} height={s(30)} radius="full" />
        <Skeleton width="90%" height={s(20)} />
        {/* The context line and the rubric link, so the cards below hold still when data lands. */}
        <Skeleton width={s(CONTEXT_SKELETON)} height={s(18)} />
        <Skeleton width={s(LINK_SKELETON)} height={s(LINK_HEIGHT)} />
        <Skeleton
          height={s(120)}
          radius="card"
          style={{ alignSelf: 'stretch', marginTop: spacing[4] }}
        />
        <Skeleton height={s(120)} radius="card" style={{ alignSelf: 'stretch' }} />
      </View>,
    );
  }

  if (resume.isError || score.isError || !resume.data || !score.data) {
    return body(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load this score"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void resume.refetch();
          void score.refetch();
        }}
      />,
    );
  }

  const current = score.data;
  const quickWins = atsQuickWins(current).length;

  return body(
    <>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: s(RING_TOP),
          paddingBottom: spacing[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <ScoreRing
            score={current.total}
            label="ATS SCORE"
            size={s(RING)}
            strokeWidth={s(RING_STROKE)}
            ringColor={atsBandColor(current.band)}
            trackColor="surfaceSubtle"
            numberVariant="scoreHero"
            numberColor="textPrimary"
            labelVariant="scoreRingLabel"
            labelColor="textSecondary"
            accessibilityLabel={`ATS score ${current.total}, ${ATS_BAND_LABEL[current.band]}`}
            // The library card's memory: opened from it, the ring carries on from the score the
            // card showed instead of sweeping up from 0 on every visit; a fix sweeps old → new.
            memoryKey={`ats:${id}`}
          />

          <ScoreBandPill band={current.band} style={{ marginTop: s(PILL_TOP) }} />

          <Text
            variant="scoreSummary"
            color="textSecondary"
            align="center"
            style={[styles.summary, { marginTop: s(SUMMARY_TOP) }]}
          >
            {current.summary}
          </Text>
          <Text
            variant="scoreContext"
            color="textTertiary"
            align="center"
            style={{ marginTop: s(CONTEXT_TOP) }}
          >
            {scoreContextLine(resume.data)}
          </Text>

          {/* V2 §7.8 — every score display carries a link to the published rubric. */}
          <Pressable
            {...a11yButton(
              'What this score measures',
              `Opens the rubric behind the ${SCORE_LABEL}`,
            )}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlopFor(s(LINK_HEIGHT))}
            onPress={() => actions.openScoreRubric(id)}
            style={{ marginTop: spacing[4] }}
          >
            <Text variant="captionSemiBold" color="link">
              What this score measures
            </Text>
          </Pressable>
          {/* V2 §7.16 — the assistant opens with this document as its context. */}
          <Pressable
            {...a11yButton('Ask about this score', 'Opens the AI assistant about this document')}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlopFor(s(LINK_HEIGHT))}
            onPress={() => actions.askAboutScore(id)}
            style={{ marginTop: spacing[4] }}
          >
            <Text variant="captionSemiBold" color="link">
              Ask about this score
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.divider,
            marginTop: s(DIVIDER_TOP),
            marginBottom: s(DIVIDER_BOTTOM),
          }}
        />

        <View style={{ gap: s(SECTION_GAP) }}>
          {current.sections.map((section, index) => (
            <ScoreSection
              key={section.key}
              section={section}
              staggerBase={index * 2}
              enter={enter}
              onFix={(item) => actions.fixWithAi(id, item)}
            />
          ))}
        </View>

        <View style={[styles.recalcRow, { gap: spacing[2], marginTop: s(SECTION_GAP) }]}>
          <FontAwesome5 name="sync-alt" size={s(RECALC_ICON)} color={colors.iconMuted} solid />
          <Text variant="scoreRecalc" color="textSecondary" style={styles.fill}>
            Green checks appear the moment a fix lands — no re-scan needed.
          </Text>
        </View>
      </ScrollView>

      {quickWins > 0 ? (
        <View
          style={[
            styles.stickyBar,
            shadows.stickyBarUp,
            {
              borderTopColor: colors.borderHairline,
              backgroundColor: colors.surfacePage,
              paddingHorizontal: spacing.gutter,
              paddingTop: spacing[4],
              paddingBottom: spacing[4] + insets.bottom,
              zIndex: zIndex.stickyBar,
            },
          ]}
        >
          <Pressable
            {...a11yButton(`Fix ${pluralize(quickWins, 'quick win')}`, 'Opens the AI fix flow')}
            feedback="scale"
            haptic="medium"
            onPress={() => actions.fixWithAi(id)}
            style={[
              styles.cta,
              {
                height: sizes.buttonLg,
                gap: s(CTA_GAP),
                borderRadius: radii.xl,
                backgroundColor: colors.surfaceInverse,
              },
            ]}
          >
            <FixSparkleIcon width={s(CTA_SPARKLE.w)} height={s(CTA_SPARKLE.h)} />
            <Text variant="scoreCta" color="textOnDark">
              {`Fix ${pluralize(quickWins, 'quick win')}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>,
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1 },
  fill: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 },
  top: { alignItems: 'center' },
  summary: { maxWidth: s(SUMMARY_WIDTH) },
  recalcRow: { flexDirection: 'row', alignItems: 'center' },
  stickyBar: { borderTopWidth: StyleSheet.hairlineWidth },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
