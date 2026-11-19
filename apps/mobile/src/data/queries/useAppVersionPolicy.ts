import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { z } from 'zod';

import { http, USES_BACKEND } from '../dataSource';

const policySchema = z.object({ minimum: z.string().nullable(), latest: z.string().nullable() });
export type AppVersionPolicy = z.infer<typeof policySchema>;

const HOUR = 60 * 60_000;

/**
 * `/app/version` (toreview §245): the oldest version the server serves and the newest in the
 * store, for this platform. Read at launch and again when the app comes back to the foreground
 * after an hour; the mock has no releases, so it reads nothing there. A failed read shows nothing:
 * an update prompt is never worth an error.
 */
export function useAppVersionPolicy() {
  return useQuery({
    queryKey: ['app', 'version', Platform.OS],
    queryFn: async () =>
      policySchema.parse(
        await http.request('/app/version', {
          query: { platform: Platform.OS },
          authenticated: false,
        }),
      ),
    enabled: USES_BACKEND && (Platform.OS === 'android' || Platform.OS === 'ios'),
    staleTime: HOUR,
    retry: false,
  });
}
