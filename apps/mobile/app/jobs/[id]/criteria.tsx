import { useLocalSearchParams } from 'expo-router';

import { MatchCriteriaScreen } from '@/features/jobs';

export default function MatchCriteriaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MatchCriteriaScreen jobId={id ?? ''} />;
}
