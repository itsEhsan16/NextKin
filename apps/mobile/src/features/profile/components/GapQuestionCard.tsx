import { useState } from 'react';
import { View } from 'react-native';

import type { GapAnswer, GapQuestion } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { ProfileCard } from './cards';

export type GapQuestionCardProps = {
  question: GapQuestion;
  busy: boolean;
  onAnswer: (answer: GapAnswer) => void;
  /** A role's end is a month and year, picked in the page's sheet. */
  onPickDate: () => void;
};

const GAP_REASONS = [
  { key: 'study', label: 'Studying' },
  { key: 'break', label: 'A break' },
  { key: 'freelance', label: 'Freelance work' },
  { key: 'leave_off', label: 'Rather not say' },
] as const;

const ELSEWHERE = 'elsewhere';
/** The strip of years an education can finish in, so a typo can't save. */
const FIRST_YEAR = 1950;
const LAST_YEAR = 2100;

/** A chip row picking one thing. */
function Choice<K extends string>(props: {
  options: readonly { key: K; label: string }[];
  picked: K | null;
  onPick: (key: K) => void;
}) {
  const { spacing } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.wrap, { gap: spacing[2] }]}>
      {props.options.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          variant="radio"
          selected={props.picked === option.key}
          onPress={() => props.onPick(option.key)}
        />
      ))}
    </View>
  );
}

/**
 * One question of the gap interview (toreview §146.7): the question, why it's asked, one way to
 * answer, and a way past it. Spec-derived from the app's card, chips and field.
 */
export function GapQuestionCard({ question, busy, onAnswer, onPickDate }: GapQuestionCardProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  const [picked, setPicked] = useState<string | null>(null);
  const [skills, setSkills] = useState<readonly string[]>([]);
  const [typed, setTyped] = useState('');

  const year = Number(typed);
  const yearOk = /^\d{4}$/.test(typed) && year >= FIRST_YEAR && year <= LAST_YEAR;
  const typedSkills = typed
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
  const allSkills = [...new Set([...skills, ...typedSkills])];

  const save = (): GapAnswer | null => {
    if (question.kind === 'education_year') return yearOk ? { kind: 'education_year', year } : null;
    if (question.kind === 'role_skills') {
      return allSkills.length > 0 ? { kind: 'role_skills', skills: allSkills } : null;
    }
    if (question.kind === 'skill_home') {
      if (!picked) return null;
      return { kind: 'skill_home', roleId: picked === ELSEWHERE ? null : picked };
    }
    if (question.kind === 'date_gap') {
      return GAP_REASONS.some((reason) => reason.key === picked)
        ? { kind: 'date_gap', reason: picked as GapAnswerReason }
        : null;
    }
    return null;
  };
  const answer = save();

  return (
    <ProfileCard style={[styles.card, { gap: spacing[3], padding: spacing[5] }]}>
      <View style={{ gap: spacing[1] }}>
        <Text {...a11yHeader()} variant="title">
          {question.title}
        </Text>
        <Text variant="caption" color="textSecondary">
          {question.detail}
        </Text>
      </View>

      {question.kind === 'role_end' ? (
        <Button label="Answer" variant="secondary" onPress={onPickDate} block />
      ) : null}

      {question.kind === 'education_year' ? (
        <TextField
          label="Year"
          value={typed}
          onChangeText={setTyped}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
        />
      ) : null}

      {question.kind === 'date_gap' ? (
        <Choice
          options={GAP_REASONS}
          picked={picked as GapAnswerReason | null}
          onPick={setPicked}
        />
      ) : null}

      {question.kind === 'skill_home' ? (
        <Choice
          options={[
            ...(question.roles ?? []).map((role) => ({ key: role.id, label: role.label })),
            { key: ELSEWHERE, label: 'A course or side project' },
          ]}
          picked={picked}
          onPick={setPicked}
        />
      ) : null}

      {question.kind === 'role_skills' ? (
        <>
          <View style={[styles.wrap, { gap: spacing[2] }]}>
            {(question.suggestions ?? []).map((skill) => (
              <FilterChip
                key={skill}
                label={skill}
                variant="toggle"
                selected={skills.includes(skill)}
                onPress={() =>
                  setSkills((current) =>
                    current.includes(skill)
                      ? current.filter((item) => item !== skill)
                      : [...current, skill],
                  )
                }
              />
            ))}
          </View>
          <TextField
            label="Or type them"
            value={typed}
            onChangeText={setTyped}
            placeholder="Separate them with commas"
            maxLength={200}
          />
        </>
      ) : null}

      <View style={[styles.actions, { gap: spacing[2] }]}>
        <Button
          label="Skip"
          variant="ghost"
          disabled={busy}
          onPress={() => onAnswer({ kind: 'skip' })}
        />
        {question.kind === 'role_end' ? null : (
          <Button
            label="Save"
            disabled={!answer}
            loading={busy}
            onPress={() => {
              if (answer) onAnswer(answer);
            }}
          />
        )}
      </View>
    </ProfileCard>
  );
}

type GapAnswerReason = (typeof GAP_REASONS)[number]['key'];

const useStyles = scaledSheet(() => ({
  card: {},
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
}));
