import { useLocalSearchParams } from 'expo-router';

import { MethodScreen } from '@/features/create';

/** "1 of 3 · Job & Resume": how to make the resume for this job (toreview §234). */
export default function MethodRoute() {
  const { jobId, jdId } = useLocalSearchParams<{ jobId?: string; jdId?: string }>();
  return <MethodScreen jobId={jobId} jdId={jdId} />;
}
