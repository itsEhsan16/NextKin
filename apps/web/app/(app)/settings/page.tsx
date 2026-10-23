import { Suspense } from 'react';

import { SettingsRoute } from '@/features/settings/screens/SettingsRoute';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { PageTransition } from '@/ui/PageTransition';

/**
 * `?tab=<section>` opens that section on arrival, e.g. `/settings?tab=security`. The parameter is read in the browser (`SettingsRoute`), so this route is
 * static and prefetched; until the browser has it (a hard load only), the screen shows its
 * default section.
 */
export default function SettingsPage() {
  return (
    <PageTransition>
      <Suspense fallback={<SettingsScreen />}>
        <SettingsRoute />
      </Suspense>
    </PageTransition>
  );
}
