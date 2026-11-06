import { Fragment, useState } from 'react';
import { View } from 'react-native';

import type { TailorComparison } from '@/data/models';
import {
  planGoalLine,
  projectedScore,
  shortOnYears,
  type CustomizeChoices,
} from '@/data/models/customize';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

import { PlanStepRow } from './PlanStepRow';
import { TailorImproveCard } from './TailorImproveCard';

export type CustomizePlanProps = {
  comparison: TailorComparison;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
};

/** Steps shown before "Show all": a phone's worth, or every step up to the goal if that is more. */
const SHOWN = 4;

// In the TAILOR 02 card's measures ("What to improve" 607:107), in artboard units.
const PAD_X = 15 / 0.75;
const RULE = 1 / 0.75;

/**
 * "Your plan to fit this job" (toreview §115, §129), mobile's side of the web's fix plan: how far
 * the honest steps go, then each step in the order the path re-scored them, the AI's own first. A
 * line marks where the plan reaches the goal. When the goal is out of reach the headline says so.
 * The ticks are the same ticks as the keyword chips below. Takes the place of "What to improve",
 * which is the same list without its points and stays for a comparison with no plan (a job that
 * gave the engine nothing to score). Spec-derived from TAILOR 02's card.
 */
export function CustomizePlan({ comparison, choices, onChange }: CustomizePlanProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const [all, setAll] = useState(false);

  const { plan } = comparison;
  if (!plan) return <TailorImproveCard improvements={comparison.improvements} />;

  const { steps, target } = plan;
  const reachAt = target?.steps ?? null;
  const shownCount = Math.max(SHOWN, reachAt ?? 0);
  const projected = projectedScore(plan, choices);

  const rows = (from: number, to: number) =>
    steps.slice(from, to).map((step, offset) => {
      const index = from + offset;
      const goalHere = target && reachAt && index === reachAt - 1 && index < steps.length - 1;
      return (
        <Fragment key={step.id}>
          {offset > 0 && index !== reachAt ? (
            <View style={[styles.rule, { backgroundColor: colors.divider }]} />
          ) : null}
          <PlanStepRow
            step={step}
            index={index}
            comparison={comparison}
            plan={plan}
            choices={choices}
            onChange={onChange}
          />
          {goalHere ? (
            <View
              accessible
              accessibilityLabel={`${target.goal.toFixed(1)} is reached here`}
              style={[styles.goal, { gap: spacing[2] }]}
            >
              <View style={[styles.goalRule, { backgroundColor: colors.success }]} />
              <Icon name="Check" size="sm" color={colors.success} />
              <Text variant="captionSemiBold" color="success">
                {`${target.goal.toFixed(1)} reached here`}
              </Text>
              <View style={[styles.goalRule, { backgroundColor: colors.success }]} />
            </View>
          ) : null}
        </Fragment>
      );
    });

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ gap: spacing[1] }}>
        <Text {...a11yHeader()} variant="title">
          Your plan to fit this job
        </Text>
        <Text variant="captionSemiBold">{planGoalLine(plan)}</Text>
        {target && target.ai > plan.score ? (
          <Text variant="micro" color="textSecondary">
            {`The AI’s own steps take it to ${target.ai.toFixed(1)}/10`}
          </Text>
        ) : null}
        {projected !== undefined && target && projected > target.ai ? (
          <Text variant="captionSemiBold" color="success" accessibilityLiveRegion="polite">
            {`With your answers so far: about ${projected.toFixed(1)}/10`}
          </Text>
        ) : null}
        {target && shortOnYears(plan) ? (
          <Text variant="micro" color="textSecondary">
            {`Below ${target.goal.toFixed(1)} only because the job wants more years than you have.`}
          </Text>
        ) : null}
      </View>

      {steps.length > 0 ? <ProfileCard>{rows(0, shownCount)}</ProfileCard> : null}
      {steps.length > shownCount ? (
        <Disclosure
          expanded={all}
          onToggle={() => setAll((open) => !open)}
          moreLabel={`Show all ${steps.length} steps`}
          lessLabel="Show the top steps only"
        >
          <ProfileCard>{rows(shownCount, steps.length)}</ProfileCard>
        </Disclosure>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  rule: { height: s(RULE), marginHorizontal: s(PAD_X) },
  goal: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(PAD_X) },
  goalRule: { flex: 1, height: s(RULE) },
}));
