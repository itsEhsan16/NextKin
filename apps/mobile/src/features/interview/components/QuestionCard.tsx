import { memo } from 'react';
import { View } from 'react-native';

import {
  INTERVIEW_GENERIC_LABEL,
  INTERVIEW_MARK_LABEL,
  INTERVIEW_QUESTION_KIND_LABEL,
  type InterviewMark,
  type InterviewQuestion,
} from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Pill';
import { Text } from '@/ui/Text';

import { ModelAnswer } from './ModelAnswer';

export type QuestionCardProps = {
  question: InterviewQuestion;
  revealed: boolean;
  /** A standalone set: §7.15 wants it visibly labelled generic wherever its questions show. */
  generic?: boolean;
  onToggleReveal: () => void;
  onMark: (mark: Exclude<InterviewMark, 'unmarked'>) => void;
};

// INTERVIEW 04 at 390 (577:3887), in artboard units.
const PAD = 18;
const GAP = 16;
const TAG_GAP = 6;
const MARK_GAP = 9;
const MARK_H = 44;

const MARK_ICON: Record<Exclude<InterviewMark, 'unmarked'>, string> = {
  confident: 'check',
  needs_work: 'redo',
};

/**
 * One question of practice mode (V2 §7.15, INTERVIEW 04 / 05): the tags, the prompt, the model
 * answer hidden until asked for, then the two marks. The two mark buttons are the whole control:
 * pressing the one already set clears it, so there is no third dead "Unmarked" button, and the
 * set one is drawn ink-filled. They never lock while a mark is in flight: the flip is optimistic,
 * and a second tap is simply the next mark (see useMarkInterviewQuestion).
 */
export const QuestionCard = memo(function QuestionCard({
  question,
  revealed,
  generic = false,
  onToggleReveal,
  onMark,
}: QuestionCardProps) {
  const { radii, s } = useTheme();
  const styles = useStyles();

  const markButton = (mark: Exclude<InterviewMark, 'unmarked'>) => {
    const selected = question.mark === mark;
    return (
      <View style={styles.markButton} accessibilityState={{ selected }}>
        <Button
          label={INTERVIEW_MARK_LABEL[mark]}
          icon={MARK_ICON[mark]}
          variant={selected ? 'primary' : 'ghost'}
          haptic="selection"
          onPress={() => onMark(mark)}
          block
          style={{ height: s(MARK_H / 0.75), borderRadius: radii.full }}
        />
      </View>
    );
  };

  return (
    <Card radius="cardLg" shadow="jobCard" padding={s(PAD / 0.75)} style={styles.card}>
      <View style={styles.tags}>
        <Pill label={INTERVIEW_QUESTION_KIND_LABEL[question.kind]} />
        {question.skill ? <Pill label={question.skill} tone="brand" /> : null}
        {question.mark === 'confident' ? (
          <Pill label={INTERVIEW_MARK_LABEL.confident} tone="success" icon="check" />
        ) : question.mark === 'needs_work' ? (
          <Pill label={INTERVIEW_MARK_LABEL.needs_work} tone="warning" icon="redo" />
        ) : null}
        {generic ? <Pill label={INTERVIEW_GENERIC_LABEL} /> : null}
      </View>

      <Text {...a11yHeader()} variant="headlineLg">
        {question.prompt}
      </Text>

      <ModelAnswer question={question} revealed={revealed} onToggle={onToggleReveal} />

      <View style={styles.marks}>
        {markButton('confident')}
        {markButton('needs_work')}
      </View>
    </Card>
  );
});

const useStyles = scaledSheet((s) => ({
  card: { gap: s(GAP / 0.75) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s(TAG_GAP / 0.75) },
  marks: { flexDirection: 'row', gap: s(MARK_GAP / 0.75) },
  markButton: { flex: 1 },
}));
