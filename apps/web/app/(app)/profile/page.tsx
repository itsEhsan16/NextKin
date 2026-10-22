import { Suspense } from 'react';

import { ProfileRoute } from '@/features/profile/screens/ProfileRoute';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { PageTransition } from '@/ui/PageTransition';

/**
 * `?tab=<section>` opens that section on arrival, e.g. `/profile?tab=skills`. The parameter is
 * read in the browser (`ProfileRoute`), so this route is static and prefetched; until the browser
 * has it (a hard load only), the screen shows Overview.
 */
export default function ProfilePage() {
  return (
    <PageTransition>
      <Suspense fallback={<ProfileScreen />}>
        <ProfileRoute />
      </Suspense>
    </PageTransition>
  );
}
