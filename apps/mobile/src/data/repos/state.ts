import {
  activityFixture,
  applicationsFixture,
  atsScoresFixture,
  contentsFixture,
  dashboardStatsFixture,
  generationsFixture,
  jdDraftsFixture,
  jobsFixture,
  notificationPrefsFixture,
  notificationsFixture,
  plansFixture,
  profileFixture,
  resumeVersionsFixture,
  resumesFixture,
  subscriptionFixture,
  userFixture,
} from '@/data/mock';
import type {
  ActivityEntry,
  Application,
  AtsScore,
  DashboardStats,
  DataExportStatus,
  DocumentContent,
  Generation,
  JdDraft,
  Job,
  Notification,
  NotificationPrefs,
  Plan,
  Profile,
  Resume,
  ResumeVersion,
  Subscription,
  User,
} from '@/data/models';

/**
 * Session-scoped in-memory database for the mock repos. Mutations persist until
 * the app restarts or `reset()` is called (tests, dev menu).
 */
export type MockState = {
  user: User;
  subscription: Subscription;
  dashboardStats: DashboardStats;
  profile: Profile;
  resumes: Resume[];
  resumeVersions: ResumeVersion[];
  atsScores: Record<string, AtsScore>;
  /**
   * Document bodies by resume id. Not every resume has one - a run in flight has no content
   * yet.
   */
  contents: Record<string, DocumentContent>;
  generations: Generation[];
  jobs: Job[];
  applications: Application[];
  /** Recruiter-side job description drafts, saved between wizard steps. */
  jdDrafts: JdDraft[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
  /** The purchasable plan catalogue - read-only reference data, never mutated by the app. */
  plans: Plan[];
  /** The account activity feed: every generation, application and billing event, newest first. */
  activity: ActivityEntry[];
  /** Where the account data export has got to; 'idle' until the settings row asks for one. */
  dataExport: DataExportStatus;
};

/** Fixtures are plain JSON (ISO strings, no Dates), so a JSON clone is a safe deep copy. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function freshState(): MockState {
  return {
    user: clone(userFixture),
    subscription: clone(subscriptionFixture),
    dashboardStats: clone(dashboardStatsFixture),
    profile: clone(profileFixture),
    resumes: clone(resumesFixture),
    resumeVersions: clone(resumeVersionsFixture),
    atsScores: clone(atsScoresFixture),
    contents: clone(contentsFixture),
    generations: clone(generationsFixture),
    jobs: clone(jobsFixture),
    applications: clone(applicationsFixture),
    jdDrafts: clone(jdDraftsFixture),
    notifications: clone(notificationsFixture),
    notificationPrefs: clone(notificationPrefsFixture),
    plans: clone(plansFixture),
    activity: clone(activityFixture),
    dataExport: { status: 'idle' },
  };
}

export type MockStore = {
  state: MockState;
  reset(): void;
};

export function createMockStore(): MockStore {
  const store: MockStore = {
    state: freshState(),
    reset() {
      store.state = freshState();
    },
  };
  return store;
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';

  constructor(entity: string, id: string) {
    super(`${entity} "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * A Pro-only action attempted on the free plan (V2 §13.5). The UI gates before it, so reaching
 * this means a locked control was bypassed.
 */
export class PlanLockedError extends Error {
  readonly code = 'PLAN_LOCKED';

  constructor(action: string) {
    super(`"${action}" needs NextKin Pro`);
    this.name = 'PlanLockedError';
  }
}

export function findOrThrow<T extends { id: string }>(items: T[], id: string, entity: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new NotFoundError(entity, id);
  return found;
}
