import type { Metadata } from 'next';
import { PromptDetailScreen } from '@/features/admin/content/screens/PromptDetailScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Prompt · NextKin Admin' };

export default async function PromptDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <PageTransition>
      <PromptDetailScreen name={decodeURIComponent(name)} />
    </PageTransition>
  );
}
