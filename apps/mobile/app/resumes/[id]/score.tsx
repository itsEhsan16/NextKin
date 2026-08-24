import { useLocalSearchParams } from 'expo-router';

import { ResumeScoreScreen } from '@/features/resumes';

export default function ResumeScoreRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ResumeScoreScreen id={id ?? ''} />;
}
