import type { Metadata } from 'next';

import { AdminSignInScreen } from '@/features/admin/signin/AdminSignInScreen';

export const metadata: Metadata = {
  title: 'Staff sign-in · NextKin',
  robots: { index: false, follow: false },
};

export default function AdminSignInPage() {
  return <AdminSignInScreen />;
}
