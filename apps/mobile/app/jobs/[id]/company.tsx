import { useLocalSearchParams } from 'expo-router';

import { CompanyScreen } from '@/features/jobs';

export default function CompanyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CompanyScreen jobId={id ?? ''} />;
}
