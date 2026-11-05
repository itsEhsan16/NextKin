import type { Metadata } from 'next';
import { TemplatesScreen } from '@/features/admin/content/screens/TemplatesScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Templates · NextKin Admin' };

export default function TemplatesPage() {
  return (
    <PageTransition>
      <TemplatesScreen />
    </PageTransition>
  );
}
