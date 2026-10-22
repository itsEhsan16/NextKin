import type { Metadata } from 'next';

import { SharedReportScreen } from '@/features/sharedReport/screens/SharedReportScreen';

/** A shared ATS report's public page (P11-10). Not indexed: a link is shared with people, not search. */
export const metadata: Metadata = {
  title: 'Shared ATS report · NextKin',
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedReportScreen token={token} />;
}
