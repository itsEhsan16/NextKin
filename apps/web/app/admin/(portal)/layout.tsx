import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { adminScaleScript } from '@/features/admin/shell/adminScale';
import { AdminShell } from '@/features/admin/shell/AdminShell';

export const metadata: Metadata = {
  title: 'NextKin Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Before the shell paints: the scale that fits the 1920 board to this window. */}
      <script dangerouslySetInnerHTML={{ __html: adminScaleScript }} />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
