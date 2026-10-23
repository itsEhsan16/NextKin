import { useLocalSearchParams } from 'expo-router';

import { BuildCompareScreen } from '@/features/create';

/** BUILD 04b: the profile against the job, before the build. */
export default function BuildCompareRoute() {
  const { jobId, jdId } = useLocalSearchParams<{ jobId?: string; jdId?: string }>();
  return <BuildCompareScreen jobId={jobId} jdId={jdId} />;
}
