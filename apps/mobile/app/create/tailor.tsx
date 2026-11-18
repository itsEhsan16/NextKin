import { Redirect, useLocalSearchParams } from 'expo-router';

import { TailorCompareScreen } from '@/features/create';

/**
 * "2 of 3 · Choose Keywords", for a listing (`jobId`) or a read JD (`jdId`), once a resume is
 * chosen. A job with no resume yet first asks how to make it (the method step, toreview §234);
 * with no job at all this is the one start, BUILD 01 (toreview §145.1).
 */
export default function TailorRoute() {
  const { jobId, jdId, resumeId } = useLocalSearchParams<{
    jobId?: string;
    jdId?: string;
    resumeId?: string;
  }>();
  if ((jobId || jdId) && !resumeId) {
    return (
      <Redirect
        href={{ pathname: '/create/method', params: jobId ? { jobId } : { jdId: jdId! } }}
      />
    );
  }
  if (jobId || jdId) return <TailorCompareScreen jobId={jobId} jdId={jdId} resumeId={resumeId} />;
  return <Redirect href={{ pathname: '/create/build', params: resumeId ? { resumeId } : {} }} />;
}
