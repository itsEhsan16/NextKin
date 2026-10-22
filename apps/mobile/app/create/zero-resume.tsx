import { useLocalSearchParams } from 'expo-router';

import { ZeroResumeScreen } from '@/features/create';

export default function ZeroResumeRoute() {
  const { jobId, role } = useLocalSearchParams<{ jobId?: string; role?: string }>();
  return <ZeroResumeScreen jobId={jobId} role={role} />;
}
