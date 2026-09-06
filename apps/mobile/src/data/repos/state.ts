import {
  activityFixture,
  applicationsFixture,
  atsScoresFixture,
  contentsFixture,
  dashboardStatsFixture,
  generationsFixture,
  jdDraftsFixture,
  faqFixture,
  jobsFixture,
  legalFixture,
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
  FaqItem,
  Application,
  AtsScore,
  DashboardStats,
  DataExportStatus,
  DocumentContent,
  Generation,
  LegalDoc,
  LegalDocKey,
  JdDraft,
  Job,
  Notification,
  NotificationPrefs,
  Plan,
  Profile,
  Resume,
  ResumeVersion,
  Subscription,
  SupportTicket,
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
  /**
   * The body as it stood at each version, keyed by version id — what §7.11's restore reads.
   *
   * Only versions this session minted are in here, plus each seeded document's current one: the
   * fixtures record that older versions happened without saying what they said. Restoring one of
   * those reports that the body is gone rather than silently re-saving the current text, which
   * would look like a restore that did nothing.
   */
  contentVersions: Record<string, DocumentContent>;
  generations: Generation[];
  jobs: Job[];
  applications: Application[];
  /** Job descriptions the candidate pasted or uploaded, kept between the intake and review steps. */
  jdDrafts: JdDraft[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
  /** The purchasable plan catalogue - read-only reference data, never mutated by the app. */
  plans: Plan[];
  /** The account activity feed: every generation, application and billing event, newest first. */
  activity: ActivityEntry[];
  /** Where the account data export has got to; 'idle' until the settings row asks for one. */
  dataExport: DataExportStatus;
  /** Help content and the two legal documents — read-only reference data (PROFILE 02 Support rows; V2 §8.5). */
  faq: FaqItem[];
  legal: Record<LegalDocKey, LegalDoc>;
  /** Support messages sent this session. The mock has no inbox; sending is the whole flow. */
  tickets: SupportTicket[];
};

/** Fixtures are plain JSON (ISO strings, no Dates), so a JSON clone is a safe deep copy. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Each seeded document's current body, filed under the version it belongs to. Everything earlier
 * predates the fixtures, so only the head of each history has a body to restore.
 */
function seedContentVersions(): Record<string, DocumentContent> {
  const seeded: Record<string, DocumentContent> = {};
  for (const resume of resumesFixture) {
    const body: DocumentContent | undefined = contentsFixture[resume.id];
    if (body) seeded[resume.currentVersionId] = clone(body);
  }
  return seeded;
}

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
    contentVersions: seedContentVersions(),
    generations: clone(generationsFixture),
    jobs: clone(jobsFixture),
    applications: clone(applicationsFixture),
    jdDrafts: clone(jdDraftsFixture),
    notifications: clone(notificationsFixture),
    notificationPrefs: clone(notificationPrefsFixture),
    plans: clone(plansFixture),
    activity: clone(activityFixture),
    dataExport: { status: 'idle' },
    faq: clone(faqFixture) as FaqItem[],
    legal: clone(legalFixture),
    tickets: [],
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
