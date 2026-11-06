import { useLocalSearchParams } from 'expo-router';

import { BuildJobScreen } from '@/features/create';

/** Kept for shares and old links: the one job step, opened with a note (toreview.md §172). */
export default function BuildAddRoute() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  return <BuildJobScreen notice={notice} />;
}
