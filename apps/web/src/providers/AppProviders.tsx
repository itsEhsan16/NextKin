'use client';

// First: the page CSP refuses eval, so zod must not probe for it (src/lib/securityHeaders.ts).
import '@nextkin/shared/schemas/jit';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '@nextkin/shared/queries';

import { AiConsentGate } from '@/features/consent/AiConsentGate';
import { ServiceBanner } from '@/features/system/ServiceBanner';
import { configureDataSource } from '@/lib/dataSource';
import { configureMockData, configureMockMode } from '@/lib/mockMode';

// The mock layer lives in @nextkin/shared, which must neither import a platform storage module
// nor know which app it serves, so the host wires both: which boards' data to seed, and where the
// mode switch persists. At module scope on purpose: both have to run before the first render,
// exactly as `apps/mobile/src/providers/AppProviders.tsx` does it.
configureMockData();
configureMockMode();
// With NEXT_PUBLIC_DATA_SOURCE set, the configured repositories talk to the backend instead.
configureDataSource();

export type AppProvidersProps = { children: ReactNode };

export function AppProviders({ children }: AppProvidersProps) {
  // Lazy initial state keeps one client per app lifetime, surviving re-renders and fast refresh.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* P12-12: opens when an AI action is refused for want of consent. */}
      <AiConsentGate />
      {/* P13-02, R-09: what is degraded right now, when the app runs on the backend. */}
      <ServiceBanner />
    </QueryClientProvider>
  );
}
