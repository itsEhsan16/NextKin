import { Redirect, useLocalSearchParams } from 'expo-router';

import { TailorCompareScreen } from '@/features/create';

/**
 * "2 of 3 · Choose Keywords", for a listing (`jobId`) or a read JD (`jdId`). With no job at all
 * this is the one start, BUILD 01 (toreview §145.1), whose "From" picks how to make the resume.
 */
export default function TailorRoute() {
  const { jobId, jdId, resumeId } = useLocalSearchParams<{
    jobId?: string;
    jdId?: string;
    resumeId?: string;
  }>();
  if (jobId || jdId) return <TailorCompareScreen jobId={jobId} jdId={jdId} resumeId={resumeId} />;
  return <Redirect href={{ pathname: '/create/build', params: resumeId ? { resumeId } : {} }} />;
}
