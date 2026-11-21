import type { Metadata } from 'next';

import { AccountDeletionScreen } from '@/features/publicPages/AccountDeletionScreen';

/** How to delete an account, public: the address Google Play's Data safety form asks for. */
export const metadata: Metadata = { title: 'Delete your account · NextKin' };

export default function AccountDeletionPage() {
  return <AccountDeletionScreen />;
}
