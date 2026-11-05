import {
  adminActivityFixture,
  adminMeFixture,
  adminOverviewFixture,
  adminQueuesFixture,
  getMockMode,
  simulate,
} from '../mock';
import {
  ADMIN_ROLE_LABEL,
  type AdminActivity,
  type AdminKpiKey,
  type AdminOverview,
  type AdminQueue,
  type AdminQueueKey,
  type AdminRange,
} from '../models/admin';

import type { AdminBusinessRepo } from './adminBusinessRepo';
import type { AdminContentRepo } from './adminContentRepo';
import type { AdminPeopleRepo } from './adminPeopleRepo';
import type { AdminTrustRepo } from './adminTrustRepo';
import { clone } from './state';
import type { AdminRepo } from './types';

/** Whether an audit row matches a search: its action, reason, staff name or role, or target ref. */
export function matchesActivity(row: AdminActivity, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.action, row.reason, row.staff.name, ADMIN_ROLE_LABEL[row.staff.role], row.target.ref]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

/** The area repositories whose live state the queues count (`createMockRepos` passes them). */
export type AdminQueueSources = {
  people: Pick<AdminPeopleRepo, 'deletionStats'>;
  content: Pick<AdminContentRepo, 'kbQueue' | 'listPrompts'>;
  trust: Pick<AdminTrustRepo, 'failureStats' | 'reportStats'>;
  business: Pick<AdminBusinessRepo, 'providers'>;
};

const DAY = 24 * 60 * 60 * 1000;

/** At or above this error rate a provider counts as erroring (the Overview's amber, 396:684). */
const PROVIDER_ERROR_RATE = 0.01;

/** The board's line for a queue while its count is still the board's; after that, `fallback`. */
function detailFor(key: AdminQueueKey, count: number, fallback: string): string {
  const drawn = adminQueuesFixture.find((queue) => queue.key === key);
  return drawn && drawn.count === count ? drawn.detail : fallback;
}

/**
 * The six queues counted from the other areas' mock state, so approving a KB diff, resolving a
 * failure or processing a deletion moves the sidebar and Needs attention with it. A source that
 * serves nothing (`null`) leaves its queue out. Provider errors have no per-incident state on the
 * mock: the board's count stands while a switched-on provider is at 1% errors or more, and goes
 * to zero once none is.
 */
async function liveQueues(sources: AdminQueueSources): Promise<AdminQueue[]> {
  const [failures, kb, deletions, reports, prompts, providers] = await Promise.all([
    sources.trust.failureStats(),
    sources.content.kbQueue(),
    sources.people.deletionStats(),
    sources.trust.reportStats(),
    sources.content.listPrompts(),
    sources.business.providers(),
  ]);
  const queues: AdminQueue[] = [];
  const add = (key: AdminQueueKey, count: number, fallback: string) =>
    queues.push({ key, count, detail: detailFor(key, count, fallback) });

  if (failures) add('generationFailures', failures.open, 'Runs waiting for a retry or a fix');
  add('kbReview', kb.length, 'Diffs waiting for approve or reject');
  if (deletions) {
    const days = deletions.nextDueAt
      ? Math.max(0, Math.ceil((Date.parse(deletions.nextDueAt) - Date.now()) / DAY))
      : null;
    add(
      'deletionRequests',
      deletions.open,
      days === null ? 'Within the 30-day limit' : `Next due in ${days} days (30-day limit)`,
    );
  }
  if (reports) add('abuseReports', reports.open, 'Reported resumes and misuse');
  add(
    'promptDrafts',
    prompts.stages.filter((stage) => stage.draft?.state === 'awaiting_eval').length,
    'Need a passing eval to publish',
  );
  const drawn = adminQueuesFixture.find((queue) => queue.key === 'providerErrors');
  if (drawn) {
    const erroring = providers.some((p) => p.enabled && (p.errorRate ?? 0) >= PROVIDER_ERROR_RATE);
    queues.push(erroring ? clone(drawn) : { ...drawn, count: 0 });
  }
  return queues;
}

/** Every headline rate on a platform with no activity: there is nothing to divide by. */
const UNMEASURED: AdminKpiKey[] = ['activation', 'reliability', 'conversion'];

/**
 * A platform with nothing in it yet: no signups, runs, spend, paying users, scores or providers.
 * Every aggregate goes to zero or empty, and every change and rate to "nothing to measure", so
 * each card shows its own empty state instead of a figure the empty platform contradicts.
 */
function emptyOverview(range: AdminRange): AdminOverview {
  const full = adminOverviewFixture(range);
  const signups = full.kpis.find((kpi) => kpi.key === 'signups');
  return {
    range,
    kpis: signups ? [{ ...signups, value: 0, delta: null, trend: [] }] : [],
    unmeasured: UNMEASURED,
    generations: full.generations && {
      totals: Object.fromEntries(
        Object.keys(full.generations.totals).map((kind) => [kind, { runs: 0, failed: 0 }]),
      ) as typeof full.generations.totals,
      delta: null,
      p95Seconds: null,
      days: [],
    },
    pipeline: full.pipeline && {
      ...full.pipeline,
      queueDepth: 0,
      queueState: 'normal',
      p95Seconds: null,
      slaMetRate: null,
    },
    aiCost: full.aiCost && { totalUsd: 0, delta: null, stages: [], costPerResumeUsd: null },
    subscriptions: full.subscriptions && {
      activePro: 0,
      delta: null,
      newThisMonth: 0,
      revenue: [],
      monthlyShare: null,
    },
    ats: full.ats && {
      mean: null,
      delta: null,
      rubricVersion: full.ats.rubricVersion,
      buckets: full.ats.buckets.map((bucket) => ({ ...bucket, count: 0 })),
    },
    providers: [],
  };
}

/**
 * The admin portal on fixtures (Figma 394:536). The Overview's aggregates are the board's; the
 * queues are counted from the other admin areas' session state when `sources` is given (the
 * app's mock set always gives it), else they are the board's six. Empty mode empties everything.
 */
export function createMockAdminRepo(sources?: AdminQueueSources): AdminRepo {
  return {
    me: () => simulate(() => clone(adminMeFixture)),
    overview: (range) =>
      simulate(() => adminOverviewFixture(range), { empty: () => emptyOverview(range) }),
    // The area calls carry the mock's latency and error mode themselves.
    queues: () =>
      sources && getMockMode() !== 'empty'
        ? liveQueues(sources)
        : simulate(() => clone(adminQueuesFixture), {
            empty: () => adminQueuesFixture.map((queue) => ({ ...queue, count: 0 })),
          }),
    activity: (query) =>
      simulate(() => clone(adminActivityFixture.filter((row) => matchesActivity(row, query))), {
        empty: () => [],
      }),
  };
}
