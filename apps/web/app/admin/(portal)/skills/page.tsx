import type { Metadata } from 'next';
import { SkillsScreen } from '@/features/admin/content/screens/SkillsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Skills & aliases · NextKin Admin' };

export default function SkillsPage() {
  return (
    <PageTransition>
      <SkillsScreen />
    </PageTransition>
  );
}
