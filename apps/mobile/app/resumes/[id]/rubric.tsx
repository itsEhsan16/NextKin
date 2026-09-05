import { useLocalSearchParams } from 'expo-router';

import { ScoreRubricScreen } from '@/features/resumes';

export default function ScoreRubricRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScoreRubricScreen id={id ?? ''} />;
}
