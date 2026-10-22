import { useQuery } from '@tanstack/react-query';

import { sharedReportSchema, type SharedReport } from '../schemas/sharedReport';

import { qk } from './keys';

/**
 * A shared ATS report, read by its public link (ImBackendImplementationPlan P11-10; V2 §4.1). Not a
 * repository: the reader is anyone with the link, signed in or not, so it is one unauthenticated
 * read of the redacted snapshot, same origin. A revoked link and a wrong one both read as missing.
 */
export class SharedReportMissingError extends Error {
  constructor() {
    super('This report link has expired or does not exist.');
    this.name = 'SharedReportMissingError';
  }
}

export async function readSharedReport(token: string, baseUrl = ''): Promise<SharedReport> {
  const response = await fetch(`${baseUrl}/api/v1/public/shared-reports/${encodeURIComponent(token)}`, { headers: { accept: 'application/json' } });
  if (response.status === 404) throw new SharedReportMissingError();
  if (!response.ok) throw new Error(`The report could not be loaded (${response.status}).`);
  return sharedReportSchema.parse(await response.json());
}

export function useSharedReport(token: string) {
  return useQuery({
    queryKey: qk.sharedReport(token),
    queryFn: () => readSharedReport(token),
    enabled: token.length > 0,
    // A missing link stays missing: no retries, so the reader sees the answer at once.
    retry: (count, error) => !(error instanceof SharedReportMissingError) && count < 2,
  });
}
