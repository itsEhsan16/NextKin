import { useLocalSearchParams } from 'expo-router';

import { BuildAddJobScreen } from '@/features/create';

/** BUILD 03: a job from anywhere. `mode=paste` (with a fresh `at`) arrives from BUILD 05b. */
export default function BuildAddRoute() {
  const { mode, at, notice } = useLocalSearchParams<{
    mode?: string;
    at?: string;
    notice?: string;
  }>();
  return <BuildAddJobScreen mode={mode} at={at} notice={notice} />;
}
