import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

import { createQueryClient } from '@nextkin/shared/queries';
import { useMockModeStore, type MockMode } from '@nextkin/shared/mock';

/**
 * Renders under a fresh QueryClient with the shared mock layer in a chosen mode.
 *
 * States are exercised through the mock repos rather than by stubbing hooks — the same choice
 * `apps/mobile` makes, and the reason its empty and error states are actually reachable code
 * paths rather than branches nothing ever runs.
 */
export function renderWithQuery(ui: ReactElement, mode: MockMode = 'normal'): RenderResult {
  useMockModeStore.setState({ mode });
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** The mock layer simulates latency; these are the waits each mode needs to settle. */
export const SETTLE_MS: Record<MockMode, number> = {
  normal: 1000,
  slow: 3000,
  empty: 800,
  error: 3500,
};
