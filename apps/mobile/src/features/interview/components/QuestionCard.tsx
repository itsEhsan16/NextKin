import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  INTERVIEW_MARK_LABEL,
  INTERVIEW_QUESTION_KIND_LABEL,
  type InterviewMark,
  type InterviewQuestion,
} from '@/data/models';
import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Disclosure } from '@/ui/Disclosure';
import { Text } from '@/ui/Text';

export type QuestionCardProps = {
  question: InterviewQuestion;
  revealed: boolean;
  onToggleReveal: () => void;
  onMark: (mark: Exclude<InterviewMark, 'unmarked'>) => void;
};

const BULLET = '•';

/**
 * One question of practice mode (V2 §7.15): the prompt, the answer hidden until asked for, then
 * the two marks. `Disclosure` is the reveal — its own doc comment names saved interview answers as
 * why it exists. The two mark buttons are the whole control: pressing the one already set clears
 * it, so there is no third dead "Unmarked" button. They never lock while a mark is in flight:
 * the flip is optimistic, and a second tap is simply the next mark (see useMarkInterviewQuestion).
 */
export const QuestionCard = memo(function QuestionCard({
  question,
  revealed,
  onToggleReveal,
  onMark,
}: QuestionCardProps) {
  const { spacing } = useTheme();

  const markButton = (mark: Exclude<InterviewMark, 'unmarked'>, icon: string): ReactNode => {
    const selected = question.mark === mark;
    return (
      <View style={styles.markButton} accessibilityState={{ selected }}>
        <Button
          label={INTERVIEW_MARK_LABEL[mark]}
          icon={icon}
          variant={selected ? 'primary' : 'secondary'}
          haptic="selection"
          onPress={() => onMark(mark)}
          block
        />
      </View>
    );
  };

  return (
    <Card radius="card" style={{ gap: spacing[4] }}>
      <View style={[styles.chips, { gap: spacing[2] }]}>
        <Chip label={INTERVIEW_QUESTION_KIND_LABEL[question.kind]} tone="neutral" />
        {question.skill ? <Chip label={question.skill} tone="brand" /> : null}
        {question.mark !== 'unmarked' ? (
          <Chip
            label={INTERVIEW_MARK_LABEL[question.mark]}
            tone={question.mark === 'confident' ? 'success' : 'neutral'}
          />
        ) : null}
      </View>

      <Text {...a11yHeader()} variant="headline">
        {question.prompt}
      </Text>

      <Disclosure
        expanded={revealed}
        onToggle={onToggleReveal}
        moreLabel="Reveal model answer"
        lessLabel="Hide model answer"
      >
        <View style={{ gap: spacing[3] }}>
          <Text variant="prose" color="textBody">
            {question.answer}
          </Text>
          {question.talkingPoints.length > 0 ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="groupLabel">Talking points</Text>
              {question.talkingPoints.map((point, index) => (
                <View key={index} style={[styles.bullet, { gap: spacing[2] }]}>
                  <Text variant="bulletBody" color="textSecondary">
                    {BULLET}
                  </Text>
                  <Text variant="bulletBody" color="textBody" style={styles.bulletText}>
                    {point}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Disclosure>

      <View style={[styles.marks, { gap: spacing[3] }]}>
        {markButton('confident', 'check')}
        {markButton('needs_work', 'redo')}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletText: { flex: 1 },
  marks: { flexDirection: 'row' },
  markButton: { flex: 1 },
});
