import { useLocalSearchParams } from 'expo-router';

import { TailorScreen } from '@/features/create';

export default function TailorRoute() {
  const { jobId, resumeId } = useLocalSearchParams<{ jobId?: string; resumeId?: string }>();
  return <TailorScreen jobId={jobId} resumeId={resumeId} />;
}
