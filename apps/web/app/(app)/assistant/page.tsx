import { Suspense } from 'react';

import { AssistantRoute } from '@/features/assistant/screens/AssistantRoute';
import { AssistantScreen } from '@/features/assistant/screens/AssistantScreen';
import { PageTransition } from '@/ui/PageTransition';

/** `?job=` / `?resume=` attach that item on arrival; read in the browser, so the route is static. */
export default function AIAssistantPage() {
  return (
    <PageTransition>
      <Suspense fallback={<AssistantScreen />}>
        <AssistantRoute />
      </Suspense>
    </PageTransition>
  );
}
