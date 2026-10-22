import { useLocalSearchParams } from 'expo-router';

import { BuildReviewScreen } from '@/features/create';

/** BUILD 04: the job as read, before the build. */
export default function BuildReviewRoute() {
  const { jdId, fileName } = useLocalSearchParams<{ jdId: string; fileName?: string }>();
  return <BuildReviewScreen jdId={jdId ?? ''} fileName={fileName} />;
}
