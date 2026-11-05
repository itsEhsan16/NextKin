import { AdminSectionScreen } from '@/features/admin/screens/AdminSectionScreen';
import { PageTransition } from '@/ui/PageTransition';

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return (
    <PageTransition>
      <AdminSectionScreen section={section} />
    </PageTransition>
  );
}
