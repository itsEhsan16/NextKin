import type { ActivityEntry } from '../../models/activity';
import type { AppSettings, PrivacySettings } from '../../models/settings';
import {
  accountSecuritySchema,
  activityEntrySchema,
  connectedAccountSchema,
  dashboardStatsSchema,
  userSchema,
} from '../../schemas/account';
import { appSettingsSchema, privacySettingsSchema } from '../../schemas/settings';
import { billingSchema, checkoutResultSchema, planListSchema, subscriptionSchema } from '../../schemas/billing';
import { aiConsentSchema, dataExportStatusSchema } from '../../schemas/privacy';
import type { Billing } from '../../models/billing';
import type { Plan } from '../../models/plan';
import type { Subscription } from '../../models/user';
import { z } from 'zod';
import type { Page, UserRepo } from '../types';
import { ApiError, collectPages, type HttpClient } from './client';
import { uploadFile, waitForScan, type FileUploader } from './uploads';

/**
 * `UserRepo` over `/api/v1/me` and `/api/v1/auth` (ImBackendImplementationPlan P5-05, P5-06).
 * The methods a later phase serves fall back to the mock through `USER_FALLBACKS`, a typed list
 * the production check reads (P5-02).
 */
export const USER_FALLBACKS = [] as const satisfies readonly (keyof UserRepo)[];

type Served = Exclude<keyof UserRepo, (typeof USER_FALLBACKS)[number]>;

const settingsSchema = z.object({ appSettings: appSettingsSchema, privacySettings: privacySettingsSchema });
const connectedSchema = z.object({ items: z.array(connectedAccountSchema) });
const activityPage = z.object({ items: z.array(activityEntrySchema), nextCursor: z.string().optional() });

export interface HttpUserRepoOptions {
  /** Posts a file to a presigned target (P7-02); without one, the avatar cannot change here. */
  uploader?: FileUploader;
  /** Web: how to send the browser to the provider for "Connect Google" (a full-page redirect). */
  navigate?: (url: string) => void;
  /** Where the provider brings the browser back to after linking. */
  linkReturnTo?: string;
  /** Web: where a finished checkout returns to (a path on this origin). Mobile keeps the default. */
  checkoutReturnPath?: string;
}

export function createHttpUserRepo(http: HttpClient, options: HttpUserRepoOptions = {}): Pick<UserRepo, Served> & { reset(): void } {
  let settingsEtag: string | null = null;

  const loadSettings = async () => {
    const result = await http.send('/me/settings');
    settingsEtag = result.etag;
    return settingsSchema.parse(result.data);
  };

  /** Merges one change in: conditional on the loaded version, reloaded and re-sent once if stale. */
  const patchSettings = async (patch: { appSettings?: Partial<AppSettings>; privacySettings?: Partial<PrivacySettings> }) => {
    if (!settingsEtag) await loadSettings();
    const send = () => http.send('/me/settings', { method: 'PATCH', body: patch, headers: { 'if-match': settingsEtag! } });
    let result;
    try {
      result = await send();
    } catch (error) {
      const stale = error instanceof ApiError && (error.code === 'PRECONDITION_FAILED' || error.code === 'PRECONDITION_REQUIRED');
      if (!stale) throw error;
      await loadSettings();
      result = await send();
    }
    settingsEtag = result.etag;
    return settingsSchema.parse(result.data);
  };

  const user = async (path = '/me', init?: Parameters<HttpClient['send']>[1]) => userSchema.parse(await http.request(path, init));
  const connected = async (init?: Parameters<HttpClient['send']>[1]) =>
    connectedSchema.parse(await http.request('/me/connected-accounts', init)).items;

  return {
    reset: () => {
      settingsEtag = null;
    },
    getCurrentUser: () => user(),
    getDashboardStats: async () => dashboardStatsSchema.parse(await http.request('/me/dashboard')),
    // The photo is uploaded, scanned, then set (P7-02); the answer carries a short-lived URL for it.
    updateAvatar: async (uri) => {
      if (!options.uploader) throw new ApiError('VALIDATION_FAILED', 'Changing the photo is not available here.', 400);
      const name = uri.split(/[\/?#]/).filter(Boolean).pop() || 'photo.jpg';
      const upload = await uploadFile(http, options.uploader, 'avatar', { name: /\.(png|jpe?g|webp)$/i.test(name) ? name : `${name}.jpg`, uri });
      await waitForScan(http, upload.id);
      return user('/me/avatar', { method: 'PUT', body: { uploadId: upload.id } });
    },
    updateName: (name) => user('/me', { method: 'PATCH', body: name }),
    // A code goes to the new address; the email changes only once it is confirmed (P5-06), so
    // until then the account still reads the old address.
    updateEmail: async (email) => {
      await http.request('/me/email', { method: 'POST', body: { email } });
      return user();
    },
    changePassword: (current, next) => http.request('/auth/password/change', { body: { current, next } }).then(() => undefined),
    signOutEverywhere: () => http.request('/auth/logout-others', { method: 'POST' }).then(() => undefined),
    getSecurity: async () => accountSecuritySchema.parse(await http.request('/me/security')),
    getAppSettings: async () => (await loadSettings()).appSettings,
    updateAppSettings: async (patch) => (await patchSettings({ appSettings: patch })).appSettings,
    getPrivacySettings: async () => (await loadSettings()).privacySettings,
    updatePrivacySettings: async (patch) => (await patchSettings({ privacySettings: patch })).privacySettings,
    listConnectedAccounts: () => connected(),
    // Linking is a redirect through the provider (spec §7.1): the page leaves, and the list is read
    // again on the way back. Without a navigator (mobile has no such screen) it is refused.
    connectAccount: async (provider) => {
      if (!options.navigate) throw new ApiError('VALIDATION_FAILED', 'Connecting an account is not available here.', 400);
      options.navigate(http.url(`/auth/link/${provider}`, { redirect: options.linkReturnTo }));
      return connected();
    },
    disconnectAccount: async (provider) =>
      connectedSchema.parse(await http.request(`/me/connected-accounts/${provider}`, { method: 'DELETE' })).items,
    // P12: billing, entitlements, consent and data rights.
    getSubscription: async () => subscriptionSchema.parse(await http.request('/me/subscription')) as Subscription,
    listPlans: async () => planListSchema.parse(await http.request('/billing/plans')).data as Plan[],
    upgrade: async (planId) => {
      if (planId === 'free') throw new ApiError('VALIDATION_FAILED', 'Free needs no checkout.', 400);
      const { url } = checkoutResultSchema.parse(await http.request('/billing/checkout', { body: { planId, ...(options.checkoutReturnPath ? { returnPath: options.checkoutReturnPath } : {}) } }));
      return { kind: 'checkout' as const, url };
    },
    getBilling: async () => billingSchema.parse(await http.request('/billing')) as Billing,
    updateBillingSettings: async (patch) => billingSchema.parse(await http.request('/billing/settings', { method: 'PATCH', body: patch })) as Billing,
    cancelSubscription: async () => subscriptionSchema.parse(await http.request('/billing/cancel', { method: 'POST' })) as Subscription,
    pauseSubscription: async (months) => subscriptionSchema.parse(await http.request('/billing/pause', { body: { months } })) as Subscription,
    resumeSubscription: async () => subscriptionSchema.parse(await http.request('/billing/resume', { method: 'POST' })) as Subscription,
    withdrawSubscription: async () => subscriptionSchema.parse(await http.request('/billing/withdraw', { method: 'POST' })) as Subscription,
    getAiConsent: async () => aiConsentSchema.parse(await http.request('/me/consents/ai')),
    grantAiConsent: async (version) => aiConsentSchema.parse(await http.request('/me/consents/ai', { body: { version } })),
    deleteAccount: () => http.request('/me', { method: 'DELETE' }).then(() => undefined),
    requestDataExport: async () => dataExportStatusSchema.parse(await http.request('/me/data-export', { method: 'POST' })),
    getDataExport: async () => dataExportStatusSchema.parse(await http.request('/me/data-export')),
    listActivity: () =>
      collectPages(async (cursor): Promise<Page<ActivityEntry>> => activityPage.parse(await http.request('/me/activity', { query: { cursor, limit: 100 } }))),
  };
}

