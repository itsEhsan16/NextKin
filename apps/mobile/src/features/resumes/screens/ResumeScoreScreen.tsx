import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FixSparkleIcon from '../../../../assets/icons/score/fix-sparkle.svg';
import { atsQuickWins } from '@/data/models';
import { useResume, useResumeScore } from '@/data/queries';
import { a11yButton, a11yHeader, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { SCORE_HERO_LINK, SCORE_HERO_RING, ScoreHero } from '../components/ScoreHero';
import { ScoreNotMeasured } from '../components/ScoreNotMeasured';
import { ScoreParts } from '../components/ScoreParts';
import { ScoreSection } from '../components/ScoreSection';
import { useResumesActions } from '../hooks/useResumesActions';
import { Icon } from '@/ui/Icon';

export type ResumeScoreScreenProps = { id: string };

/**
 * Vertical rhythm on the 390 board (95:2310), in artboard units: back button → the lead 28 (37),
 * context → divider 22 (29), divider → first heading 24 (32), sections 31.25 apart (42) and the
 * same again down to the recalc line.
 */
const RING_TOP = 37;
const DIVIDER_TOP = 29;
const DIVIDER_BOTTOM = 32;
const SECTION_GAP = 42;
/** The CTA's sparkle (529:19) is drawn 23.99 × 24.83, 4 short of its label, at 390. */
const CTA_SPARKLE = { w: 23.99 / 0.75, h: 24.83 / 0.75 } as const;
const CTA_GAP = 4 / 0.75;
/** Skeleton bars standing in for the context line (captionSm) and that link. */
const CONTEXT_SKELETON = 200;
const LINK_SKELETON = 160;

/**
 * RESUMES 04 — ATS score panel (Figma 95:2310), off the board at its top (owner, 2026-11-01,
 * toreview §146.1): the count of required skills leads with a smaller ring beside it, then where
 * the points go and what the score doesn't measure, then the board's checklist. Pushed from a
 * card's ATS badge. The back row is pinned above the scroller, and so is the "Fix N quick wins" bar
 * below it, which disappears once nothing is left to fix. The bar's CTA is `sizes.buttonLg`, the height of every other
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
        <IconButton icon="ChevronLeft" label="Back" onPress={actions.goBack} />
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
      <View style={{ padding: spacing.gutter, gap: spacing[4] }}>
        <View style={[styles.lead, { gap: spacing[4], marginTop: spacing[4] }]}>
          <View style={[styles.fill, { gap: spacing[2] }]}>
            <Skeleton width="80%" height={s(34)} />
            <Skeleton width="60%" height={s(20)} />
            <Skeleton width={s(120)} height={s(30)} radius="full" />
          </View>
          <Skeleton width={s(SCORE_HERO_RING)} height={s(SCORE_HERO_RING)} radius="full" />
        </View>
        <Skeleton width="90%" height={s(20)} />
        {/* The context line and the rubric link, so the cards below hold still when data lands. */}
        <Skeleton width={s(CONTEXT_SKELETON)} height={s(18)} />
        <Skeleton width={s(LINK_SKELETON)} height={s(SCORE_HERO_LINK)} />
        <Skeleton height={s(120)} radius="card" style={{ marginTop: spacing[4] }} />
        <Skeleton height={s(120)} radius="card" />
      </View>,
    );
  }

  if (resume.isError || score.isError || !resume.data || !score.data) {
    return body(
      <StateView
        tone="danger"
        icon="AlertTriangle"
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
  const { report } = current;

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
        <ScoreHero
          id={id}
          score={current}
          resume={resume.data}
          onRubric={() => actions.openScoreRubric(id)}
          onAsk={() => actions.askAboutScore(id)}
        />

        {report ? (
          <View style={{ gap: s(SECTION_GAP), marginTop: s(DIVIDER_TOP) }}>
            <ScoreParts parts={report.components} />
            <ScoreNotMeasured lines={report.notMeasured} />
          </View>
        ) : null}

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
          <Icon name="RefreshCw01" size="xs" color={colors.iconMuted} />
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
  lead: { flexDirection: 'row', alignItems: 'center' },
  recalcRow: { flexDirection: 'row', alignItems: 'center' },
  stickyBar: { borderTopWidth: StyleSheet.hairlineWidth },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
