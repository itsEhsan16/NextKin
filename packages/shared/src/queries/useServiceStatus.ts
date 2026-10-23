import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { qk } from './keys';

/**
 * Degraded modes (ImBackendImplementationPlan P13-02, R-09): which capabilities are running
 * degraded, read from `/health/features`, for the one banner both apps show. Each app passes its
 * own loader (through its HTTP client) only when it runs on the backend; the mock has no outages,
 * so without a loader nothing is shown. Read every minute; a failed read shows nothing rather than
 * a second warning.
 */
export const serviceStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  capabilities: z.array(z.object({ capability: z.string(), degraded: z.boolean(), since: z.string().optional(), message: z.string().optional() })),
});
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

const MINUTE = 60_000;

export function useServiceStatus(load: (() => Promise<unknown>) | null) {
  return useQuery({
    queryKey: qk.serviceStatus(),
    queryFn: async () => serviceStatusSchema.parse(await load!()),
    enabled: load !== null,
    refetchInterval: MINUTE,
    retry: false,
  });
}

/** The banner's lines: one per degraded capability, in a stable order. */
export const degradedMessages = (status: ServiceStatus | undefined): string[] =>
  (status?.capabilities ?? []).filter((c) => c.degraded && c.message).map((c) => c.message!);
