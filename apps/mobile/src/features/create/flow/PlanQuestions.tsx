import { useState } from 'react';
import { View } from 'react-native';

import type { TailorComparison } from '@/data/models';
import {
  tickKeyword,
  togglePlace,
  type CustomizeChoices,
  type PlanStep,
} from '@/data/models/customize';
import { scaledSheet } from '@/theme';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Text } from '@/ui/Text';

import { FlowCard, FlowDivider, FlowSection } from './FlowKit';

/** At most this many questions: the ones worth the most come first. */
const MAX_QUESTIONS = 6;

/**
 * The questions the score still needs, from the plan (owner, 2026-11-09, §202), asked before the
 * build rather than after it. Each is a skill the job asks for:
 * - one the resume only lists ("You list Kafka. Which role used it?"): half credit until a dated
 *   role shows it;
 * - one it doesn't show at all ("Have you used Kafka?"): nothing until the user says yes.
 * The user answers with a role (that is a confirmation the run writes as a fact there), or with
 * "No". Nothing is assumed (D-14): an unanswered question changes nothing.
 */
export function questionSteps(steps: readonly PlanStep[]): PlanStep[] {
  return steps
    .filter(
      (s) =>
        s.who === 'you' &&
        (s.kind === 'keyword' || s.kind === 'evidence') &&
        s.keyword &&
        (s.worth ?? 0) > 0,
    )
    .slice(0, MAX_QUESTIONS);
}

export function PlanQuestions({
  comparison,
  goal,
  projected,
  choices,
  onChange,
}: {
  comparison: TailorComparison;
  /** Out of 10. */
  goal: number;
  projected?: number;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const styles = useStyles();
  const [declined, setDeclined] = useState<readonly string[]>([]);
  const steps = questionSteps(comparison.plan?.steps ?? []);
  const places = comparison.places ?? [];
  if (steps.length === 0 || places.length === 0) return null;

  const placed = (keyword: string) => (choices.places[keyword]?.where.length ?? 0) > 0;
  const open = steps.filter((s) => !placed(s.keyword!) && !declined.includes(s.keyword!)).length;
  const body =
    projected !== undefined && projected >= goal
      ? `Your answers take it to ${goal}/10.`
      : open > 0
        ? `Projected ${projected?.toFixed(1) ?? '–'}/10 · answer ${open} more to get closer to ${goal}.`
        : `Projected ${projected?.toFixed(1) ?? '–'}/10 with your answers.`;

  return (
    <FlowSection icon="Target" title={`Answer to reach ${goal}`} body={body}>
      <FlowCard style={styles.card}>
        {steps.map((step, index) => {
          const keyword = step.keyword!;
          const listed = step.kind === 'evidence';
          const no = declined.includes(keyword) && !placed(keyword);
          const where = choices.places[keyword]?.where ?? [];
          return (
            <View key={step.id}>
              {index > 0 ? <FlowDivider /> : null}
              <View style={styles.question}>
                <Text variant="bodySemiBold" color="ink">
                  {listed
                    ? `You list ${keyword}. Which role used it?`
                    : `Have you used ${keyword}?`}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {listed
                    ? `Half credit until a role shows it · +${step.worth?.toFixed(1)}`
                    : `The job asks for it · up to +${step.worth?.toFixed(1)}`}
                </Text>
                <View style={styles.chips}>
                  {places.map((place) => (
                    <ChoiceChip
                      key={place.id}
                      label={place.label}
                      selected={where.includes(place.id)}
                      onPress={() => {
                        setDeclined((d) => d.filter((k) => k !== keyword));
                        onChange(
                          togglePlace(choices, keyword, place.id, !where.includes(place.id)),
                        );
                      }}
                    />
                  ))}
                  <ChoiceChip
                    label={listed ? 'Not in a role' : 'No'}
                    selected={no}
                    onPress={() => {
                      setDeclined((d) => (d.includes(keyword) ? d : [...d, keyword]));
                      // "No" to a skill the resume doesn't list takes the tick off too.
                      onChange(
                        listed
                          ? { ...choices, places: withoutPlace(choices, keyword) }
                          : tickKeyword(choices, keyword, false),
                      );
                    }}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </FlowCard>
    </FlowSection>
  );
}

const withoutPlace = (c: CustomizeChoices, keyword: string) => {
  const places = { ...c.places };
  delete places[keyword];
  return places;
};

const useStyles = scaledSheet((_s, u) => ({
  card: { paddingVertical: u(4) },
  question: { gap: u(6), paddingVertical: u(14) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(4) },
}));
