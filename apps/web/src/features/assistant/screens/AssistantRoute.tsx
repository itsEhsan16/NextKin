'use client';

import { useSearchParams } from 'next/navigation';

import { AssistantScreen } from './AssistantScreen';

/** `/assistant?job=<id>` or `?resume=<id>` opens with that item attached (`../assistantHref.ts`). */
export function AssistantRoute() {
  const params = useSearchParams();
  return (
    <AssistantScreen
      jobId={params.get('job') ?? undefined}
      resumeId={params.get('resume') ?? undefined}
    />
  );
}
