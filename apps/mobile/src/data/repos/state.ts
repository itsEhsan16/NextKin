import {
  applicationsFixture,
  atsScoresFixture,
  dashboardStatsFixture,
  generationsFixture,
  jobsFixture,
  notificationPrefsFixture,
  notificationsFixture,
  profileFixture,
  resumeVersionsFixture,
  resumesFixture,
  subscriptionFixture,
  userFixture,
} from '@/data/mock';
import type {
  Application,
  AtsScore,
  DashboardStats,
  Generation,
  Job,
  Notification,
  NotificationPrefs,
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
  generations: Generation[];
  jobs: Job[];
  applications: Application[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
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
    generations: clone(generationsFixture),
    jobs: clone(jobsFixture),
    applications: clone(applicationsFixture),
    notifications: clone(notificationsFixture),
    notificationPrefs: clone(notificationPrefsFixture),
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

export function findOrThrow<T extends { id: string }>(items: T[], id: string, entity: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new NotFoundError(entity, id);
  return found;
}
