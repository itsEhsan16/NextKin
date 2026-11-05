import type { Metadata } from 'next';
import { AnalyticsScreen } from '@/features/admin/business/screens/AnalyticsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Analytics · NextKin Admin' };

export default function AdminAnalyticsPage() {
  return (
    <PageTransition>
      <AnalyticsScreen />
    </PageTransition>
  );
}
