import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { interviewMarkCounts, setForApplication, type Application, type Job } from '@/data/models';
import { useInterviewSets } from '@/data/queries';
// Deep import on purpose: the interview barrel drags its screens in. This is pure.
import { marksLine } from '@/features/interview/practiceRows';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

export const PRACTICE_TITLE = 'Practice for this interview';
export const PRACTICE_NEW = 'Write practice questions';
export const PRACTICE_RESUME = 'Keep practising';
const PRACTICE_LEDE = 'Questions written from your resume and this job.';

export type ApplicationPracticeProps = { application: Application; job: Job };

/**
 * Interview prep tied to a real application (owner, 2026-11-01, toreview §147.5): the set already
 * written for this job, or a way to write one from the resume it was sent with. It only appears
 * once they have an interview, so it's never one more thing to do before that.
 */
export function ApplicationPractice({ application, job }: ApplicationPracticeProps) {
  const { spacing } = useTheme();
  const router = useRouter();
  const sets = useInterviewSets();
  const set = setForApplication(sets.data ?? [], application);

  const writeNew = () =>
    router.push({
      pathname: '/interview/new',
      params: {
        ...(application.resumeId ? { resumeId: application.resumeId } : {}),
        roleTitle: job.title,
      },
    });

  return (
    <Card radius="card">
      <View style={{ gap: spacing[1] }}>
        <Text variant="title" accessibilityRole="header">
          {PRACTICE_TITLE}
        </Text>
        <Text variant="body" color="textBody">
          {set ? marksLine(interviewMarkCounts(set)) : PRACTICE_LEDE}
        </Text>
      </View>
      <Button
        label={set ? PRACTICE_RESUME : PRACTICE_NEW}
        block
        disabled={sets.isPending}
        onPress={() =>
          set ? router.push({ pathname: '/interview/[id]', params: { id: set.id } }) : writeNew()
        }
        style={{ marginTop: spacing[4] }}
      />
    </Card>
  );
}
