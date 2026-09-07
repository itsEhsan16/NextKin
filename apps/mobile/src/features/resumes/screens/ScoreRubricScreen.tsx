import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SCORE_HONESTY_NOTE, SCORE_LABEL, SCORE_RUBRIC } from '@/data/models';
import { useResume } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Disclosure } from '@/ui/Disclosure';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { useResumesActions } from '../hooks/useResumesActions';

export type ScoreRubricScreenProps = { id: string };

/** Row inset inside the rubric card — the settings-row inset the preferences card uses. */
const ROW_INSET = 19;
/**
 * The caption skeleton is two bars, not one: the line it stands in for wraps at the gutter, and
 * `18 + spacing[1] + 18` is the two 20pt caption lines — so nothing below it jumps when the
 * document title lands.
 */
const CAPTION_SKELETON_BAR = 18;
const CAPTION_SKELETON_TAIL = 200;

/**
 * The published rubric (V2 §7.8): what the score is, what it is not, and the five weighted
 * components behind the number. §7.8 requires this page to be reachable from every score display,
 * so `ResumeScoreScreen`'s "What this score measures" link lands here.
 *
 * Spec-derived, not drawn: no artboard exists, so it is assembled from the built primitives only.
 */
export function ScoreRubricScreen({ id }: ScoreRubricScreenProps) {
  const { colors, spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();
  const actions = useResumesActions();

  const resume = useResume(id);

  const [open, setOpen] = useState<readonly string[]>([]);
  const toggle = (key: string) =>
    setOpen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  /**
   * The rubric is static content, so the resume query only ever names the document in the caption
   * below. Deliberately there is no page-level loading or error state and no `StateView`: a failed
   * or missing resume must not blank the one page that explains what the number means — the reader
   * may well have arrived here *because* something looked wrong. So every state the query can be
   * in lands on this one caption, and the rubric renders either way. There is likewise no empty
   * state; the page always has all five components to show.
   */
  // `useResume` is disabled for an empty id, and a disabled query sits at `pending` for ever — so
  // the skeleton is gated on the id as well. Without that, a route opened without one would pulse
  // here indefinitely instead of falling through to the static line, which is the whole point.
  const naming = id.length > 0 && resume.isPending;

  const caption = naming ? (
    <View style={{ gap: spacing[1] }}>
      <Skeleton height={s(CAPTION_SKELETON_BAR)} />
      <Skeleton width={s(CAPTION_SKELETON_TAIL)} height={s(CAPTION_SKELETON_BAR)} />
    </View>
  ) : (
    <Text variant="caption" color="textTertiary">
      {resume.data
        ? `Opened from "${resume.data.title}" — every document is scored the same way.`
        : 'Every document is scored the same way.'}
    </Text>
  );

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={`How the ${SCORE_LABEL} works`} onBack={actions.goBack} />}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <Card style={{ marginTop: spacing[5] }}>
        <Text variant="body" color="textBody">
          {SCORE_HONESTY_NOTE}
        </Text>
      </Card>

      <View style={{ marginTop: spacing[3] }}>{caption}</View>

      <Text
        variant="overline"
        color="textSecondary"
        accessibilityRole="header"
        style={{ marginTop: spacing[7] }}
      >
        WHAT IT MEASURES
      </Text>

      <Card radius="card" padding={0} style={{ marginTop: spacing[3] }}>
        {SCORE_RUBRIC.map((component, index) => (
          <Animated.View
            key={component.key}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
          >
            {index > 0 ? (
              <View
                style={[
                  styles.divider,
                  { marginHorizontal: s(ROW_INSET), backgroundColor: colors.divider },
                ]}
              />
            ) : null}
            <Disclosure
              mode="row"
              title={`${component.label} — ${component.weight}%`}
              expanded={open.includes(component.key)}
              onToggle={() => toggle(component.key)}
              style={{ paddingHorizontal: s(ROW_INSET) }}
            >
              <Text variant="rowDescription" color="textSecondary">
                {component.detail}
              </Text>
            </Disclosure>
          </Animated.View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
});
