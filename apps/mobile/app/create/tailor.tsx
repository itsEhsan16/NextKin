import { useLocalSearchParams } from 'expo-router';

import { JobIntakeScreen, TailorCompareScreen } from '@/features/create';

/**
 * The job → resume flow (toreview §114): with a listing (`jobId`) or a read JD (`jdId`), the one
 * Customize screen; with neither, "Add a job", which opens Customize once the job is read.
 */
export default function TailorRoute() {
  const { jobId, jdId, resumeId } = useLocalSearchParams<{
    jobId?: string;
    jdId?: string;
    resumeId?: string;
  }>();
  return jobId || jdId ? (
    <TailorCompareScreen jobId={jobId} jdId={jdId} resumeId={resumeId} />
  ) : (
    <JobIntakeScreen resumeId={resumeId} />
  );
}
