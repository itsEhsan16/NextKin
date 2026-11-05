import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SessionBridgeScreen } from '@/features/auth/screens/SessionBridgeScreen';
import { CLERK_ENABLED } from '@/lib/clerk';

export const metadata: Metadata = { title: 'Signing in · NextKin' };

export default function SessionPage() {
  if (!CLERK_ENABLED) notFound();
  return <SessionBridgeScreen />;
}
