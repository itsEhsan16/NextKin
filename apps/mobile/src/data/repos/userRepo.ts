import { getMockMode, newId, simulate } from '@/data/mock';
import type {
  ActivityEntry,
  Notification,
  PlanId,
  SubscriptionUsage,
  User,
} from '@/data/models';
import { SUBSCRIPTION_PLAN_LABEL } from '@/data/models';

import { clone, findOrThrow, type MockStore } from './state';
import type { UserRepo } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the mock archive takes to build; the settings row polls `getDataExport` meanwhile. */
export const DATA_EXPORT_MS = 4000;

/** One JSON document of the account's own data, behind a link that stops working after a day. */
const EXPORT_FILE_NAME = 'nextkin-export.json';
const EXPORT_SIZE_LABEL = '4.2 MB';
const EXPORT_TTL_DAYS = 1;

/** Renewal period per SKU (V2 §13.2): the monthly plan bills every 30 days, the annual every 365. */
const RENEWAL_DAYS: Record<PlanId, number> = { free: 30, pro_monthly: 30, pro_annual: 365 };

/**
 * V2 §13.3, Pro column, as the numbers the usage meters render. The spec publishes 100/month for
 * generations and 30/month for standalone ATS checks; the rows it words as "unlimited within fair
 * use" (cover letters, interview sets, assistant messages) carry that same published generation
 * cap rather than an unpublished Infinity — §13.1 forbids a hidden limit.
 */
const PRO_LIMITS = {
  generationsLimit: 100,
  coverLettersLimit: 100,
  resumesLimit: 100,
  atsChecksLimit: 30,
  assistantMessagesLimit: 100,
  interviewSetsLimit: 100,
} as const;

const byCreatedDesc = (a: ActivityEntry, b: ActivityEntry): number =>
  b.createdAt.localeCompare(a.createdAt);

/** ISO `days` out from now. Stored as a string so `MockState` stays JSON-safe (no Dates). */
const daysFromNow = (days: number): string =>
  new Date(new Date().getTime() + days * DAY_MS).toISOString();

export function createMockUserRepo(store: MockStore): UserRepo {
  const patchUser = (patch: Partial<User>): User => {
    store.state.user = { ...store.state.user, ...patch };
    return clone(store.state.user);
  };

  /** Only one archive builds at a time; a second request while preparing joins the first. */
  let exportTimer: ReturnType<typeof setTimeout> | undefined;

  const finishExport = (): void => {
    exportTimer = undefined;
    const { requestedAt } = store.state.dataExport;
    // Mode is read when the timer fires, not when the export was asked for — the same rule the
    // generation ticker follows, so flipping the dev switch mid-build fails the archive.
    store.state.dataExport =
      getMockMode() === 'error'
        ? { status: 'failed', requestedAt, error: 'Simulated failure' }
        : {
            status: 'ready',
            requestedAt,
            readyAt: new Date().toISOString(),
            fileName: EXPORT_FILE_NAME,
            sizeLabel: EXPORT_SIZE_LABEL,
            expiresAt: daysFromNow(EXPORT_TTL_DAYS),
          };
  };

  return {
    getCurrentUser: () => simulate(() => clone(store.state.user)),
    getSubscription: () => simulate(() => clone(store.state.subscription)),
    getDashboardStats: () => simulate(() => clone(store.state.dashboardStats)),

    updateName: ({ firstName, lastName }) =>
      simulate(() => patchUser({ firstName: firstName.trim(), lastName: lastName.trim() })),

    updateEmail: (email) => simulate(() => patchUser({ email: email.trim() })),

    updateAvatar: (uri) => simulate(() => patchUser({ avatarUrl: uri })),

    // V2 §8.4: only Cognito ever holds a password, so there is nothing here to verify against —
    // the real client proxies to the identity service and surfaces its rejection.
    changePassword: () => simulate(() => {}),

    signOutEverywhere: () => simulate(() => {}),

    // Deliberately leaves the store alone. Deletion is the host's job: it clears the query caches
    // and the session, and a mock that wiped the fixtures would leave the app rendering an empty
    // account behind the confirmation sheet instead of returning to sign-in.
    deleteAccount: () => simulate(() => {}),

    listPlans: () => simulate(() => clone(store.state.plans), { empty: () => [] }),

    // V2 §13 — moving onto a plan raises the entitlements, writes the billing event to the audit
    // trail and posts the receipt-style notification the feed's "Account" filter is for.
    upgrade: (planId) =>
      simulate(() => {
        const plan = findOrThrow(store.state.plans, planId, 'Plan');
        const { subscription } = store.state;
        const usage: SubscriptionUsage =
          plan.tier === 'pro'
            ? {
                ...subscription.usage,
                ...PRO_LIMITS,
                aiCreditsLeft: Math.max(
                  0,
                  PRO_LIMITS.generationsLimit - subscription.usage.generationsUsed,
                ),
              }
            : subscription.usage;
        store.state.subscription = {
          ...subscription,
          plan: plan.tier,
          status: 'active',
          renewsAt: daysFromNow(RENEWAL_DAYS[planId]),
          usage,
        };

        const createdAt = new Date().toISOString();
        const entry: ActivityEntry = {
          id: newId('act'),
          kind: 'plan',
          title: `Upgraded to **${plan.name}**`,
          detail: `₹${plan.price.amount} per ${plan.price.period}`,
          createdAt,
          deepLink: '/placeholder/upgrade',
        };
        store.state.activity = [entry, ...store.state.activity];

        const welcome: Notification = {
          id: newId('ntf'),
          category: 'billing',
          body: `Welcome to **${SUBSCRIPTION_PLAN_LABEL[plan.tier]}** — your higher caps are live.`,
          createdAt,
          read: false,
          deepLink: '/placeholder/upgrade',
          visual: { kind: 'glyph', icon: 'credit-card', tone: 'brand' },
        };
        store.state.notifications = [welcome, ...store.state.notifications];

        return clone(store.state.subscription);
      }),

    requestDataExport: () =>
      simulate(() => {
        // Two taps on the settings row must not build two archives; the second joins the first.
        if (store.state.dataExport.status !== 'preparing') {
          if (exportTimer) clearTimeout(exportTimer);
          store.state.dataExport = { status: 'preparing', requestedAt: new Date().toISOString() };
          exportTimer = setTimeout(finishExport, DATA_EXPORT_MS);
        }
        return clone(store.state.dataExport);
      }),

    getDataExport: () => simulate(() => clone(store.state.dataExport)),

    listActivity: () =>
      simulate(() => clone([...store.state.activity].sort(byCreatedDesc)), { empty: () => [] }),
  };
}
