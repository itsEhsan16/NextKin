import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SparkleIcon from '../../../../assets/icons/ai-sparkle.svg';
import { ATS_BAND_LABEL, atsQuickWins, type AtsBand } from '@/data/models';
import { useResume, useResumeScore } from '@/data/queries';
import { a11yButton, a11yHeader, pluralize } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { ScoreSection } from '../components/ScoreSection';
import { atsBandColor, scoreContextLine } from '../docMeta';
import { useResumesActions } from '../hooks/useResumesActions';

export type ResumeScoreScreenProps = { id: string };

const RING = 132;
const RING_STROKE = 10;
const CTA_HEIGHT = 56;

const BAND_SURFACE: Record<AtsBand, ColorToken> = {
  strong: 'successSurface',
  good: 'warningSurface',
  fair: 'dangerSurface',
  weak: 'dangerSurface',
};

const BAND_TEXT: Record<AtsBand, ColorToken> = {
  strong: 'success',
  good: 'warningStrong',
  fair: 'danger',
  weak: 'danger',
};

/**
 * RESUMES 04 — ATS score panel (Figma 1:2109). Pushed from a card's ATS badge. Header scrolls
 * with the page; only the "Fix N quick wins" bar is pinned, and it disappears once nothing is
 * left to fix.
 */
export function ResumeScoreScreen({ id }: ResumeScoreScreenProps) {
  const { colors, radii, shadows, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const actions = useResumesActions();

  const resume = useResume(id);
  const score = useResumeScore(id);

  const body = (children: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: colors.surfacePage, paddingTop: insets.top }]}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.gutter, paddingTop: spacing[2] }]}>
        <IconButton icon="chevron-left" label="Back" onPress={actions.goBack} />
        <Text {...a11yHeader()} variant="title" style={styles.headerTitle} align="center">
          ATS score
        </Text>
        {/* Mirrors the back button so the centred title stays centred. */}
        <View style={styles.headerSpacer} />
      </View>
      {children}
    </View>
  );

  if (resume.isPending || score.isPending) {
    return body(
      <View style={{ padding: spacing.gutter, gap: spacing[4], alignItems: 'center' }}>
        <Skeleton width={RING} height={RING} radius="full" style={{ marginTop: spacing[4] }} />
        <Skeleton width={120} height={30} radius="full" />
        <Skeleton width="90%" height={20} />
        <Skeleton height={120} radius="card" style={{ alignSelf: 'stretch', marginTop: spacing[4] }} />
        <Skeleton height={120} radius="card" style={{ alignSelf: 'stretch' }} />
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
        style={{ marginTop: spacing[10] }}
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
          paddingTop: spacing[4],
          paddingBottom: spacing[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: spacing[4] }}>
          <ScoreRing
            score={current.total}
            label="ATS SCORE"
            size={RING}
            strokeWidth={RING_STROKE}
            ringColor={atsBandColor(current.band)}
            trackColor="surfaceSubtle"
            numberVariant="scoreHero"
            numberColor="textPrimary"
            labelVariant="microOverline"
            labelColor="textSecondary"
            accessibilityLabel={`ATS score ${current.total}, ${ATS_BAND_LABEL[current.band]}`}
          />

          <View
            style={{
              borderRadius: radii.full,
              backgroundColor: colors[BAND_SURFACE[current.band]],
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Text variant="captionSemiBold" color={BAND_TEXT[current.band]}>
              {ATS_BAND_LABEL[current.band]}
            </Text>
          </View>

          <Text variant="rowLabel" color="textSecondary" align="center" style={styles.summary}>
            {current.summary}
          </Text>
          <Text variant="captionSm" color="textTertiary" align="center">
            {scoreContextLine(resume.data)}
          </Text>
        </View>

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.divider,
            marginVertical: spacing[5],
          }}
        />

        <View style={{ gap: spacing[6] }}>
          {current.sections.map((section, index) => (
            <ScoreSection
              key={section.key}
              section={section}
              staggerBase={index * 2}
              onFix={actions.fixWithAi}
            />
          ))}
        </View>

        <View style={[styles.recalcRow, { gap: spacing[2], marginTop: spacing[6] }]}>
          <FontAwesome5 name="sync-alt" size={11} color={colors.iconMuted} solid />
          <Text variant="caption" color="textSecondary" style={styles.fill}>
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
            },
          ]}
        >
          <Pressable
            {...a11yButton(`Fix ${pluralize(quickWins, 'quick win')}`, 'Opens the AI fix flow')}
            feedback="scale"
            haptic="medium"
            onPress={actions.fixWithAi}
            style={[
              styles.cta,
              {
                height: CTA_HEIGHT,
                gap: spacing[2] + 2,
                borderRadius: radii.xl,
                backgroundColor: colors.surfaceInverse,
              },
            ]}
          >
            <SparkleIcon width={15} height={15} color={colors.textOnDark} />
            <Text variant="label" color="textOnDark">
              {`Fix ${pluralize(quickWins, 'quick win')}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 },
  headerSpacer: { width: 48 },
  summary: { maxWidth: 320 },
  recalcRow: { flexDirection: 'row', alignItems: 'center' },
  stickyBar: { borderTopWidth: StyleSheet.hairlineWidth },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
