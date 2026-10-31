import { useLocalSearchParams } from 'expo-router';

import { UploadResumeScreen } from '@/features/create';

/** `next=job`: a first resume, so the review leads on to picking a job (toreview §145.2). */
export default function UploadResumeRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <UploadResumeScreen thenPickJob={next === 'job'} />;
}
