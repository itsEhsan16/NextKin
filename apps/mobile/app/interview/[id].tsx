import { useLocalSearchParams } from 'expo-router';

import { InterviewPracticeScreen } from '@/features/interview';

export default function InterviewPracticeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InterviewPracticeScreen id={id ?? ''} />;
}
