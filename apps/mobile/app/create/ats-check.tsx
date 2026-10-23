import { useLocalSearchParams } from 'expo-router';

import { AtsCheckScreen } from '@/features/create';

export default function AtsCheckRoute() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  return <AtsCheckScreen jobId={jobId} />;
}
