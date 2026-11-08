import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  ATS_BAND_LABEL,
  ATS_CHECK_LEDE,
  atsCheckTitle,
  SCORE_LABEL,
  scoreLead,
  type AtsCheckResult,
} from '@/data/models';
import { FlowCard, FlowDivider, IconTile, StatusPill } from '@/features/create/flow/FlowKit';
// Deep imports on purpose: the resumes barrel drags its screens in.
import { ScoreNotMeasured } from '@/features/resumes/components/ScoreNotMeasured';
import { ScoreParts } from '@/features/resumes/components/ScoreParts';
import { a11yHeader, useReducedMotion } from '@/lib';
import { motion, scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';

const blockIn = (index: number) =>
  FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * motion.stagger.card * 3).duration(
    motion.durations.base,
  );

const BAND_TONE = { strong: 'success', good: 'success', fair: 'warning', weak: 'warning' } as const;

function Stat({ icon, value, label }: { icon: LineIconName; value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.stat, { backgroundColor: colors.surfaceSubtle }]}
    >
      <Icon name={icon} size="sm" color={colors.brand} />
      <Text variant="title3" color="ink">
        {value}
      </Text>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

/** A card whose body opens on a tap: "4 fixes", "Score details". */
function Fold({
  icon,
  title,
  body,
  children,
}: {
  icon: LineIconName;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <FlowCard style={styles.fold}>
      <Pressable
        feedback="subtle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${body}`}
        onPress={() => setOpen((v) => !v)}
        style={styles.foldHead}
      >
        <IconTile name={icon} size={36} />
        <View style={styles.flex}>
          <Text variant="bodyLgStrong" color="ink">
            {title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {body}
          </Text>
        </View>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size="sm" color={colors.iconMuted} />
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </FlowCard>
  );
}

export type AtsResultProps = {
  result: AtsCheckResult;
  onRubric: () => void;
  /** The check finished while the user watched: the blocks rise in turn. */
  arrived?: boolean;
};

/**
 * An ATS check's result (toreview §173, Figma "ATS · 2 Result"): the score card with its band, the
 * required-skills line and three stat tiles; the missing keywords; the fixes and the score's
 * parts folded until asked. Every score still links its rubric (§7.8).
 */
export function AtsResult({ result, onRubric, arrived = false }: AtsResultProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const enter = (index: number) => (arrived && !reduced ? blockIn(index) : undefined);
  const lead = scoreLead(result.report);
  const formatting = result.report?.components.find((c) => c.key === 'formatting');
  const formatPass = formatting?.score != null ? formatting.score >= 80 : undefined;
  const outOfTen = (Math.round(result.score) / 10).toFixed(1);

  return (
    <View style={styles.wrap}>
      <Text variant="footnote" color="textSecondary">
        {result.company ? `ATS check · ${result.company}` : 'ATS check'}
      </Text>

      <Animated.View entering={enter(0)}>
        <FlowCard style={styles.hero}>
          <View style={styles.heroRow}>
            <ScoreRing
              score={result.score}
              valueText={outOfTen}
              label="out of 10"
              size={u(104)}
              strokeWidth={u(9)}
              ringColor={
                result.band === 'strong' || result.band === 'good' ? 'success' : 'warningAccent'
              }
              numberVariant="numberLg"
              labelVariant="footnote"
              labelColor="textSecondary"
              accessibilityLabel={`${SCORE_LABEL} ${outOfTen} out of 10, ${ATS_BAND_LABEL[result.band]}`}
            />
            <View style={styles.heroText}>
              <StatusPill
                label={`${ATS_BAND_LABEL[result.band]} match`}
                tone={BAND_TONE[result.band]}
              />
              <Text variant="title3" color="ink" {...a11yHeader()}>
                {lead?.headline ? `${lead.headline} skills` : atsCheckTitle(result)}
              </Text>
              <Pressable
                feedback="subtle"
                accessibilityRole="button"
                accessibilityLabel={`How the ${SCORE_LABEL} works`}
                onPress={onRubric}
                style={styles.link}
              >
                <Text variant="footnote" color="brand">
                  How the score works
                </Text>
                <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
              </Pressable>
            </View>
          </View>
          <View style={styles.stats}>
            <Stat icon="Key01" value={String(result.missing.length)} label="Missing" />
            <Stat icon="Tool02" value={String(result.fixes.length)} label="Fixes" />
            <Stat
              icon="LayoutTop"
              value={formatPass == null ? '—' : formatPass ? 'Pass' : 'Check'}
              label="Format"
            />
          </View>
        </FlowCard>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.section}>
        <Text variant="title3" color="ink" {...a11yHeader()}>
          Missing keywords
        </Text>
        {/* §7.8 / D-14: a missing keyword is a gap to fill truthfully, never text to paste in. */}
        <Text variant="callout" color="textSecondary">
          {result.missing.length > 0
            ? 'Add only the ones you really have.'
            : 'Your resume already shows every keyword the job asks for.'}
        </Text>
        {result.missing.length > 0 ? (
          <View style={styles.chips}>
            {result.missing.map((keyword) => (
              <View
                key={keyword}
                style={[
                  styles.chip,
                  { borderColor: colors.borderDefault, backgroundColor: colors.surfaceCard },
                ]}
              >
                <Text variant="footnote" color="ink">
                  {keyword}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.section}>
        <Fold
          icon="Tool02"
          title={`${result.fixes.length} ${result.fixes.length === 1 ? 'fix' : 'fixes'}`}
          body={
            result.fixes.length > 0
              ? result.fixes
                  .map((f) => f.title)
                  .slice(0, 3)
                  .join(', ')
              : 'Nothing needs changing'
          }
        >
          {result.fixes.map((fix, index) => (
            <View key={fix.key}>
              {index > 0 ? <FlowDivider /> : null}
              <View
                accessible
                accessibilityLabel={`${index + 1}. ${fix.title}. ${fix.detail}`}
                style={styles.fixRow}
              >
                <Text variant="bodyLgStrong" color="brand">
                  {String(index + 1)}
                </Text>
                <View style={styles.flex}>
                  <Text variant="bodyLgStrong" color="ink">
                    {fix.title}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {fix.detail}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Fold>
        {result.report ? (
          <Fold icon="LineChartUp01" title="Score details" body={ATS_CHECK_LEDE[result.band]}>
            <ScoreParts parts={result.report.components} />
            <ScoreNotMeasured lines={result.report.notMeasured} />
          </Fold>
        ) : null}
      </Animated.View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(20), paddingTop: u(4), width: '100%' },
  flex: { flex: 1, gap: u(2) },
  hero: { gap: u(16) },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: u(18) },
  heroText: { flex: 1, gap: u(6) },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2), alignSelf: 'flex-start' },
  stats: { flexDirection: 'row', gap: u(8) },
  stat: {
    flex: 1,
    gap: u(2),
    paddingHorizontal: u(12),
    paddingVertical: u(10),
    borderRadius: u(16),
  },
  section: { gap: u(10) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(4) },
  chip: { paddingHorizontal: u(14), paddingVertical: u(9), borderRadius: u(999), borderWidth: 1 },
  fold: { paddingVertical: u(4) },
  foldHead: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(12) },
  foldBody: { gap: u(4), paddingBottom: u(12) },
  fixRow: { flexDirection: 'row', gap: u(12), paddingVertical: u(10) },
}));
