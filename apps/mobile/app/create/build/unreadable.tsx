import { useLocalSearchParams } from 'expo-router';

import { BuildUnreadableScreen } from '@/features/create';

/** BUILD 05b: the job page refused to be read. */
export default function BuildUnreadableRoute() {
  const { url } = useLocalSearchParams<{ url: string }>();
  return <BuildUnreadableScreen url={url ?? ''} />;
}
