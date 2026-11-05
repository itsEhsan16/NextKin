import type { Metadata } from 'next';
import { RubricScreen } from '@/features/admin/content/screens/RubricScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'ATS rubric · NextKin Admin' };

export default function RubricPage() {
  return (
    <PageTransition>
      <RubricScreen />
    </PageTransition>
  );
}
