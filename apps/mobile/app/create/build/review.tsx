import { useLocalSearchParams } from 'expo-router';

import { BuildOpenMatch } from '@/features/create';

/** A job that was already read (a share) goes straight to the match (toreview.md §172). */
export default function BuildReviewRoute() {
  const { jdId } = useLocalSearchParams<{ jdId: string }>();
  return <BuildOpenMatch jdId={jdId ?? ''} />;
}
