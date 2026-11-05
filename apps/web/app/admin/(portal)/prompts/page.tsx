import type { Metadata } from 'next';
import { PromptsScreen } from '@/features/admin/content/screens/PromptsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'AI prompts · NextKin Admin' };

export default function PromptsPage() {
  return (
    <PageTransition>
      <PromptsScreen />
    </PageTransition>
  );
}
