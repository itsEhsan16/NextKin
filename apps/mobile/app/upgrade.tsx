import { useLocalSearchParams } from 'expo-router';

import { isUpgradeReason, UpgradeScreen } from '@/features/billing';

export default function UpgradeRoute() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const key = reason ?? '';
  // An unknown reason is simply no reason: the screen drops its banner rather than inventing one.
  return <UpgradeScreen reason={isUpgradeReason(key) ? key : undefined} />;
}
