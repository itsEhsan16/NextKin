import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GapQuestion } from '@/data/models';
import { queryPhase, useAnswerGap, useGapQuestions, useResume } from '@/data/queries';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { MonthYearSheet } from '@/ui/MonthYearSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { GapQuestionCard } from '../components/GapQuestionCard';
import { useProfileActions } from '../hooks/useProfileActions';

const LEDE = 'Short answers about your own history. Skip any of them.';
export const REMAKE_TITLE = 'Your profile has new facts';
export const REMAKE_MESSAGE = 'Make this resume again to use them.';

export type GapInterviewScreenProps = {
  /** The resume just finished, when the questions were opened from it. */
  resumeId?: string;
};

/**
 * The gap interview (owner, 2026-11-01, toreview §146.7): up to seven short, skippable questions the
 * engine picked from holes in the profile. What's answered becomes the person's own fact, and the
 * next resume is written from it. It's reached from Profile and from a finished resume, never in the
 * first-run path. Spec-derived from the app's cards, chips and fields.
 *
 * Answers don't change a finished resume's score: it belongs to that version. So once the last
 * question is answered, it offers once to make the resume again (owner, toreview §148.1).
 */
export function GapInterviewScreen({ resumeId }: GapInterviewScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useProfileActions();
  const questions = useGapQuestions();
  const answer = useAnswerGap();
  const router = useRouter();
  const resume = useResume(resumeId ?? '');
  // Answers saved on this visit; skips don't count, because they add nothing to the profile.
  const [answered, setAnswered] = useState(0);
  const save = (id: string, next: Parameters<typeof answer.mutate>[0]['answer']) =>
    answer.mutate(
      { id, answer: next },
      { onSuccess: () => next.kind !== 'skip' && setAnswered((count) => count + 1) },
    );
  // The role whose end is being picked, in the page's sheet.
  const [dating, setDating] = useState<GapQuestion | null>(null);
  const status = queryPhase(questions);

  const page = (children: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="Quick questions" onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[4] }}
      >
        {children}
      </Screen>
      {/* Sheets are siblings of the page, never children of its scroller. */}
      <MonthYearSheet
        open={dating !== null}
        title={dating?.title ?? ''}
        allowPresent
        presentLabel="I still work here"
        onClose={() => setDating(null)}
        onSelect={(picked) => {
          if (dating) {
            save(dating.id, { kind: 'role_end', end: picked === 'present' ? null : picked });
          }
          setDating(null);
        }}
      />
    </View>
  );

  if (status === 'pending') {
    return page(
      <View accessible accessibilityLabel="Loading your questions" style={{ gap: spacing[3] }}>
        {[0, 1].map((key) => (
          <Skeleton key={key} height={s(180)} radius="card" />
        ))}
      </View>,
    );
  }

  if (status === 'error') {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your questions"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void questions.refetch()}
      />,
    );
  }

  const list = questions.data ?? [];
  if (list.length === 0 && answered > 0) {
    const jobId = resume.data?.linkedJobId;
    return page(
      <StateView
        icon="CheckCircle"
        title={REMAKE_TITLE}
        message={REMAKE_MESSAGE}
        actionLabel={jobId ? 'Make it again' : 'Make a resume with them'}
        onAction={() =>
          jobId
            ? router.push({ pathname: '/create/tailor', params: { jobId } })
            : router.push('/create/build')
        }
      />,
    );
  }

  if (list.length === 0) {
    return page(
      <StateView
        icon="CheckCircle"
        title="Nothing to ask right now"
        message="Your profile has no gaps we can see."
        actionLabel="Back to your profile"
        onAction={actions.goBack}
      />,
    );
  }

  return page(
    <>
      <View style={{ gap: spacing[1] }}>
        <Text variant="captionSemiBold">{`${pluralize(list.length, 'question')} left`}</Text>
        <Text variant="caption" color="textSecondary">
          {LEDE}
        </Text>
      </View>
      {answer.isError ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          We couldn’t save that. Check your connection and try again.
        </Text>
      ) : null}
      {list.map((question) => (
        <GapQuestionCard
          key={question.id}
          question={question}
          busy={answer.isPending && answer.variables?.id === question.id}
          onAnswer={(next) => save(question.id, next)}
          onPickDate={() => setDating(question)}
        />
      ))}
    </>,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
