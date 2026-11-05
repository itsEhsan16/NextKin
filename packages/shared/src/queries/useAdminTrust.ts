import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AdminSettingsPatch,
  AuditFilters,
  FailureQuery,
  ReportAction,
  ReportCategory,
  ReportFilter,
} from '../models/adminTrust';
import { repos } from '../repos';

/**
 * The admin portal's Trust & safety area: generation failures, abuse reports, the audit log,
 * admin settings and staff sign-in (Figma 406:1195, 407:946, 408:1531, 409:1500, 410:1605).
 * Keys start `['admin', 'trust', ...]`, so `qk.admin.all` still sweeps them, and an action
 * refreshes what it changed plus the sidebar's queue counts.
 */
const trust = {
  all: ['admin', 'trust'] as const,
  failureStats: () => ['admin', 'trust', 'failure-stats'] as const,
  failures: (query: FailureQuery) => ['admin', 'trust', 'failures', query] as const,
  failure: (id: string) => ['admin', 'trust', 'failure', id] as const,
  reportStats: () => ['admin', 'trust', 'report-stats'] as const,
  reports: (filter: ReportFilter, search: string, page: number, categories: ReportCategory[]) =>
    ['admin', 'trust', 'reports', filter, search, page, categories] as const,
  report: (id: string) => ['admin', 'trust', 'report', id] as const,
  audit: (filters: AuditFilters, page: number) =>
    ['admin', 'trust', 'audit', filters, page] as const,
  settings: () => ['admin', 'trust', 'settings'] as const,
};

/** The Overview's and the sidebar's queue counts, which a failure or report action changes. */
const QUEUES = ['admin', 'queues'] as const;

export function useFailureStats() {
  return useQuery({
    queryKey: trust.failureStats(),
    queryFn: () => repos.adminTrust.failureStats(),
  });
}

/** One page of failed runs; switching tab or page keeps the last rows until the next arrive. */
export function useFailures(query: FailureQuery) {
  return useQuery({
    queryKey: trust.failures(query),
    queryFn: () => repos.adminTrust.failures(query),
    placeholderData: keepPreviousData,
  });
}

export function useFailureDetail(id: string | null) {
  return useQuery({
    queryKey: trust.failure(id ?? ''),
    queryFn: () => repos.adminTrust.failureDetail(id!),
    enabled: id !== null,
  });
}

function useTrustMutation<A, R>(run: (args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: trust.all }),
        client.invalidateQueries({ queryKey: QUEUES }),
      ]);
    },
  });
}

export function useRetryFailures() {
  return useTrustMutation((ids: string[]) => repos.adminTrust.retryFailures(ids));
}

export function useResolveFailure() {
  return useTrustMutation((id: string) => repos.adminTrust.resolveFailure(id));
}

/** Not a query: it runs when Export is pressed and hands back the file's text. */
export const exportFailures = (query: FailureQuery) => repos.adminTrust.exportFailures(query);

export function useReportStats() {
  return useQuery({ queryKey: trust.reportStats(), queryFn: () => repos.adminTrust.reportStats() });
}

export function useReports(
  filter: ReportFilter,
  search: string,
  page: number,
  categories: ReportCategory[] = [],
) {
  return useQuery({
    queryKey: trust.reports(filter, search, page, categories),
    queryFn: () => repos.adminTrust.reports(filter, search, page, categories),
    placeholderData: keepPreviousData,
  });
}

export function useReport(id: string | null) {
  return useQuery({
    queryKey: trust.report(id ?? ''),
    queryFn: () => repos.adminTrust.report(id!),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  });
}

export function useActOnReport() {
  return useTrustMutation(
    (args: { id: string; action: ReportAction; reason: string; note: string }) =>
      repos.adminTrust.actOnReport(args.id, args),
  );
}

export const exportReports = (
  filter: ReportFilter,
  search: string,
  categories: ReportCategory[] = [],
) => repos.adminTrust.exportReports(filter, search, categories);

/** One page of the audit log under its filters. */
export function useAuditLog(filters: AuditFilters, page: number) {
  return useQuery({
    queryKey: trust.audit(filters, page),
    queryFn: () => repos.adminTrust.audit(filters, page),
    placeholderData: keepPreviousData,
  });
}

export const exportAudit = (filters: AuditFilters) => repos.adminTrust.exportAudit(filters);

export function useAdminSettings() {
  return useQuery({ queryKey: trust.settings(), queryFn: () => repos.adminTrust.settings() });
}

/** Saves a settings change and writes the server's answer straight into the cache. */
export function useUpdateAdminSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: AdminSettingsPatch) => repos.adminTrust.updateSettings(patch),
    onSuccess: (settings) => client.setQueryData(trust.settings(), settings),
  });
}

export function useRegenerateBackupCodes() {
  return useTrustMutation((_: void) => repos.adminTrust.regenerateBackupCodes());
}

/** Settings › Replace authenticator, step 1: a new authenticator to scan. Not cached. */
export function useBeginAuthenticatorReplacement() {
  return useMutation({ mutationFn: (_: void) => repos.adminTrust.beginAuthenticatorReplacement() });
}

/** Step 2: one code from the new authenticator; answers with new backup codes. */
export function useConfirmAuthenticatorReplacement() {
  return useTrustMutation((input: { challenge: string; code: string }) =>
    repos.adminTrust.confirmAuthenticatorReplacement(input),
  );
}

/** Proves the authenticator again before a sensitive action. */
export function useAdminReauthenticate() {
  return useMutation({ mutationFn: (code: string) => repos.adminTrust.reauthenticate(code) });
}

/** Staff sign-in; not cached, since each attempt is its own. */
export function useAdminSignIn() {
  return useMutation({
    mutationFn: (input: { email: string; password: string; totp?: string }) =>
      repos.adminTrust.signIn(input),
  });
}

/** First sign-in: confirm the new authenticator with one code. */
export function useAdminConfirmEnrollment() {
  return useMutation({
    mutationFn: (input: { challenge: string; code: string }) =>
      repos.adminTrust.confirmEnrollment(input),
  });
}

/** First sign-in or after a reset: replace the temporary password. */
export function useAdminSetNewPassword() {
  return useMutation({
    mutationFn: (input: { challenge: string; password: string }) =>
      repos.adminTrust.setNewPassword(input),
  });
}

/** The checks and masks the Trust screens share: networks, backup codes, IPs (pure). */
export {
  BACKUP_CODE,
  isNetwork,
  maskIp,
  networkCovers,
  STAFF_PASSWORD_MIN,
} from '../repos/adminTrustRepo';
