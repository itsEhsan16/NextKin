import {
  activityFixture,
  appSettingsFixture,
  billingFixture,
  conversationFixture,
  assistantHistoryFixture,
  applicationsFixture,
  contentsFixture,
  connectedAccountsFixture,
  dashboardStatsFixture,
  documentsFixture,
  generationsFixture,
  interviewSetsFixture,
  jdDraftsFixture,
  faqFixture,
  getMockPlatform,
  jobsFixture,
  legalFixture,
  notificationPrefsFixture,
  notificationSettingsFixture,
  notificationsFixture,
  plansFixture,
  privacySettingsFixture,
  profileFixture,
  resumeVersionsFixture,
  resumesFixture,
  securityFixture,
  subscriptionFixture,
  userFixture,
  webApplicationsFixture,
  webContentsFixture,
  webJobsFixture,
  webProfileFixture,
  webResumeVersionsFixture,
  webResumesFixture,
  webUserFixture,
} from '../mock';
import type {
  AccountSecurity,
  ActivityEntry,
  Billing,
  AppSettings,
  AssistantConversation,
  FaqItem,
  Application,
  AtsScore,
  CareerDocument,
  ConnectedAccount,
  DashboardStats,
  DataExportStatus,
  DocumentContent,
  Generation,
  InterviewSet,
  LegalDoc,
  LegalDocKey,
  JdDraft,
  Job,
  Notification,
  NotificationPrefs,
  NotificationSettings,
  Plan,
  PrivacySettings,
  Profile,
  Resume,
  ResumeVersion,
  Subscription,
  SupportTicket,
  User,
} from '../models';
import type { ScoringJd } from '../scoring/report';
import { EXPORT_BLOCK_MESSAGE, type ExportBlock } from '../models/exportBlock';
import { AI_PROVIDER_LIST } from '../models/consent';

import { seedScores } from './scoring';

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
  /** Score panels by resume id, computed by the engines (C-10); absent where no total exists (D-15). */
  atsScores: Record<string, AtsScore>;
  /** The JD each resume was scored against, so an edit re-scores against the same one. */
  scoringJds: Record<string, ScoringJd>;
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
  /** The candidate's own files (Figma 286:2026). Web draws them; mobile has no screen for them. */
  documents: CareerDocument[];
  /** Job descriptions the candidate pasted or uploaded, kept between the intake and review steps. */
  jdDrafts: JdDraft[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
  /** The web Settings → Notifications board's channels and topics (Figma 247:1290). */
  notificationSettings: NotificationSettings;
  /** The purchasable plan catalogue - read-only reference data, never mutated by the app. */
  plans: Plan[];
  /** The account activity feed: every generation, application and billing event, newest first. */
  activity: ActivityEntry[];
  /** Where the account data export has got to; 'idle' until the settings row asks for one. */
  dataExport: DataExportStatus;
  /** The AI provider list version the account agreed to (P12-12); null when it has not. */
  aiConsentVersion: string | null;
  /** The password's age, two-factor and the signed-in devices (the web Settings board, 254:522). */
  security: AccountSecurity;
  /** How the app looks and behaves for this account (web Settings → Preferences, 356:85). */
  appSettings: AppSettings;
  /** Who can see the profile, and the analytics opt-out (web Settings → Privacy & data). */
  privacySettings: PrivacySettings;
  /** The card on file, renewal and invoices (web Settings → Billing & plan, 470:3). */
  billing: Billing;
  /** The sign-in accounts the user can link: Google (web Settings → Connected accounts). */
  connectedAccounts: ConnectedAccount[];
  /** Help content and the two legal documents — read-only reference data (PROFILE 02 Support rows; V2 §8.5). */
  faq: FaqItem[];
  legal: Record<LegalDocKey, LegalDoc>;
  /** Support messages sent this session. The mock has no inbox; sending is the whole flow. */
  tickets: SupportTicket[];
  /** Practice sets, newest first (V2 §7.15). Marks live on the questions and persist. */
  interviewSets: InterviewSet[];
  /** The account's current assistant conversation (V2 §7.16). Token buffers are NOT here. */
  assistant: AssistantConversation;
  /** The web History's earlier chats (767:2), newest first. Mobile never lists them. */
  assistantHistory: AssistantConversation[];
};

/** Fixtures are plain JSON (ISO strings, no Dates), so a JSON clone is a safe deep copy. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Each seeded document's current body, filed under the version it belongs to. Everything earlier
 * predates the fixtures, so only the head of each history has a body to restore.
 */
function seedContentVersions(
  resumes: Resume[],
  contents: Record<string, DocumentContent>,
): Record<string, DocumentContent> {
  const seeded: Record<string, DocumentContent> = {};
  for (const resume of resumes) {
    const body: DocumentContent | undefined = contents[resume.id];
    if (body) seeded[resume.currentVersionId] = clone(body);
  }
  return seeded;
}

/**
 * The resumes the mock library starts with. A library served over HTTP never shows them: they are
 * the mock's own examples, not the user's (toreview §110: the tailor dialog offered one). What the
 * mock makes during a session, a mock run's document, still shows beside the server's.
 */
export function seededResumeIds(): ReadonlySet<string> {
  const fixtures = getMockPlatform() === 'web' ? webResumesFixture : resumesFixture;
  return new Set(fixtures.map((resume) => resume.id));
}

function freshState(): MockState {
  const state = seedState();
  // Every seeded score comes from the engines, like a generated one (C-10).
  seedScores(state);
  return state;
}

function seedState(): MockState {
  // The account, jobs, applications and the resume library are the per-platform part of the seed
  // (`mock/platform.ts`); everything else is shared.
  const web = getMockPlatform() === 'web';
  const resumes = web ? webResumesFixture : resumesFixture;
  const contents = web ? webContentsFixture : contentsFixture;
  return {
    user: clone(web ? webUserFixture : userFixture),
    subscription: clone(subscriptionFixture),
    dashboardStats: clone(dashboardStatsFixture),
    profile: clone(web ? webProfileFixture : profileFixture),
    resumes: clone(resumes),
    resumeVersions: clone(web ? webResumeVersionsFixture : resumeVersionsFixture),
    atsScores: {},
    scoringJds: {},
    contents: clone(contents),
    contentVersions: seedContentVersions(resumes, contents),
    generations: clone(generationsFixture),
    jobs: clone(web ? webJobsFixture : jobsFixture),
    applications: clone(web ? webApplicationsFixture : applicationsFixture),
    documents: clone(documentsFixture),
    jdDrafts: clone(jdDraftsFixture),
    notifications: clone(notificationsFixture),
    notificationPrefs: clone(notificationPrefsFixture),
    notificationSettings: clone(notificationSettingsFixture),
    plans: clone(plansFixture),
    activity: clone(activityFixture),
    dataExport: { status: 'idle' },
    aiConsentVersion: AI_PROVIDER_LIST.version,
    security: clone(securityFixture),
    appSettings: clone(appSettingsFixture),
    privacySettings: clone(privacySettingsFixture),
    billing: clone(billingFixture),
    connectedAccounts: clone(connectedAccountsFixture),
    faq: clone(faqFixture) as FaqItem[],
    legal: clone(legalFixture),
    tickets: [],
    interviewSets: clone(interviewSetsFixture),
    assistant: clone(conversationFixture),
    assistantHistory: clone(assistantHistoryFixture),
  };
}

export type MockStore = {
  state: MockState;
  reset(): void;
};

/**
 * Seeded on first read rather than when the module loads: a host picks its platform at module
 * scope, which runs after this module has loaded, and the seed has to come from that choice.
 */
export function createMockStore(): MockStore {
  let state: MockState | undefined;
  return {
    get state() {
      state ??= freshState();
      return state;
    },
    set state(next) {
      state = next;
    },
    reset() {
      state = freshState();
    },
  };
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
  /** From the server (P12-09): the meter or cap, its limit, and when it resets. */
  reason?: string;
  limit?: number;
  resetsAt?: string;

  constructor(action: string) {
    super(`"${action}" needs NextKin Pro`);
    this.name = 'PlanLockedError';
  }
}

/**
 * AI work refused until the user consents to the AI providers (P12-12). The apps answer it with
 * the consent dialog and retry.
 */
export class ConsentRequiredError extends Error {
  readonly code = 'CONSENT_REQUIRED';

  constructor(message = 'Agree to how NextKin uses AI to continue.') {
    super(message);
    this.name = 'ConsentRequiredError';
  }
}

/**
 * An export refused until the user does something: confirm the version is accurate, finish the
 * Zero Resume review, or verify their email. `reason` tells the screen which.
 */
export class ExportBlockedError extends Error {
  readonly code = 'EXPORT_BLOCKED';

  constructor(
    readonly reason: ExportBlock,
    message: string = EXPORT_BLOCK_MESSAGE[reason],
  ) {
    super(message);
    this.name = 'ExportBlockedError';
  }
}

export function findOrThrow<T extends { id: string }>(items: T[], id: string, entity: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new NotFoundError(entity, id);
  return found;
}
