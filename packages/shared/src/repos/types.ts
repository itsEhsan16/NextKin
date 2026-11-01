import type { ProductEvent } from '../schemas/events';
import type { FigureDraft,
  TailorComparison,
  AiConsent,
  AccountSecurity,
  Billing,
  BillingSettings,
  ActivityEntry,
  AppSettings,
  Application,
  ApplicationAnswer,
  ApplicationAsk,
  ApplicationStatus,
  ApplicationTarget,
  AssistantConversation,
  AssistantAttachment,
  AssistantMessage,
  AssistantThreadSummary,
  InsightsRange,
  ApplicationWithJob,
  AtsScore,
  CareerDocument,
  CareerInsights,
  Certification,
  ConnectedAccount,
  ConnectedProvider,
  CoverLetterContent,
  DashboardStats,
  DataExportStatus,
  DocumentContent,
  Education,
  Experience,
  FaqItem,
  Generation,
  GenerationInput,
  InterviewMark,
  InterviewSet,
  JdDraft,
  JdDraftPatch,
  JdFile,
  JdInput,
  JdMatch,
  Job,
  JobLinkPreview,
  JobFilters,
  LegalDoc,
  LegalDocKey,
  JobSort,
  Notification,
  NotificationPrefs,
  PushDevice,
  NotificationSettings,
  Plan,
  PlanId,
  PrivacySettings,
  Profile,
  ProfileDraft,
  ProfileLink,
  ProfilePatch,
  ConfirmFacts,
  GapAnswer,
  GapQuestion,
  ProfilePreferences,
  Resume,
  ExportReceipt,
  LineSource,
  ResumeContent,
  VersionChange,
  ResumeDocument,
  ResumeDocumentWrite,
  ResumeDocType,
  ResumeSectionKey,
  ResumeVersion,
  SavedJobsSort,
  Subscription,
  SupportTicket,
  TicketInput,
  User,
  ZeroCheckResult,
  ZeroResolution,
} from '../models';
import type { ResumePreview } from '../schemas/resumePreview';
import type { ResumeFit } from '../schemas/resumeFit';

/**
 * Repository contracts. Screens never talk to these directly — query hooks in
 * @/data/queries do. Swapping the mock implementations for HTTP clients later
 * must not change a single hook signature.
 */

export type Page<T> = {
  items: T[];
  /** Opaque; pass back to `list` to fetch the next page. Absent on the last page. */
  nextCursor?: string;
};

/** What starting an upgrade gives back: the new entitlements at once, or a checkout to open. */
export type UpgradeResult = { kind: 'done'; subscription: Subscription } | { kind: 'checkout'; url: string };

export type UserRepo = {
  getCurrentUser(): Promise<User>;
  getSubscription(): Promise<Subscription>;
  getDashboardStats(): Promise<DashboardStats>;
  /** Account name from the edit-account form — personal info (V2 §7.3). */
  updateName(name: { firstName: string; lastName: string }): Promise<User>;
  /** Account email (V2 §7.3); re-verification is the server's business, not the caller's. */
  updateEmail(email: string): Promise<User>;
  /** Avatar picked on device; the real API uploads the file behind this and returns the URL. */
  updateAvatar(uri: string): Promise<User>;
  /** Password change, rejected when `current` is wrong (V2 §7.1; §8.4 — only Cognito ever
   *  holds a password, so this proxies rather than verifies). */
  changePassword(current: string, next: string): Promise<void>;
  /** Revokes every other session (V2 §7.1 session management; §11 `POST /auth/logout-all`). */
  signOutEverywhere(): Promise<void>;
  /** When the password last changed, two-factor, and the signed-in devices (V2 §7.1). */
  getSecurity(): Promise<AccountSecurity>;
  /** How the app looks and behaves for this account (web Settings → Preferences, 356:85). */
  getAppSettings(): Promise<AppSettings>;
  /** Merges one change in and returns the whole set: each control saves on its own. */
  updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  /** Who can see the profile, and the analytics opt-out (web Settings → Privacy & data). */
  getPrivacySettings(): Promise<PrivacySettings>;
  /** Merges one change in and returns the whole set, as `updateAppSettings` does. */
  updatePrivacySettings(patch: Partial<PrivacySettings>): Promise<PrivacySettings>;
  /** The card on file, renewal and invoices (web Settings → Billing & plan, 470:3; V2 §13.4). */
  getBilling(): Promise<Billing>;
  /** Merges one renewal change in and returns the whole of billing, as `updateAppSettings` does. */
  updateBillingSettings(patch: Partial<BillingSettings>): Promise<Billing>;
  /** The sign-in accounts V2 §7.1 links through Cognito: Google on the web Settings page. */
  listConnectedAccounts(): Promise<ConnectedAccount[]>;
  /**
   * Links one and returns the whole list. Provisional: V2 signs in with Google through a redirect
   * (`GET /api/v1/auth/login/:provider`, back at `/callback`) and links the account in Cognito's
   * Pre sign-up trigger, so the real client may only start that redirect here and read the list
   * on the way back. V2 names no endpoint for the list or for unlinking yet (`toreview.md` §30).
   */
  connectAccount(provider: ConnectedProvider): Promise<ConnectedAccount[]>;
  /** Unlinks one and returns the whole list. Provisional, as `connectAccount` is. */
  disconnectAccount(provider: ConnectedProvider): Promise<ConnectedAccount[]>;
  /** Irreversible account deletion (V2 §8.5). */
  deleteAccount(): Promise<void>;
  /** The purchasable SKUs behind the plan screen (V2 §13.2). */
  listPlans(): Promise<Plan[]>;
  /**
   * Moves onto a paid plan (V2 §13). The mock does it at once (`done`). The backend starts a hosted
   * checkout (`checkout`, P12-06): the app opens the URL (mobile in the browser, D-18: nothing is
   * sold in the app) and the plan changes when the gateway's verified webhook lands.
   */
  upgrade(planId: PlanId): Promise<UpgradeResult>;
  /** §13.4: cancel in one step, effective at the end of the paid period (the Kündigungsbutton). */
  cancelSubscription(): Promise<Subscription>;
  /** §13.6: pause for one to three months instead of cancelling. */
  pauseSubscription(months: 1 | 2 | 3): Promise<Subscription>;
  /** Ends a pause, or undoes a pending cancellation. */
  resumeSubscription(): Promise<Subscription>;
  /** The 14-day withdrawal right: ends now and refunds the first payment (P12-10). */
  withdrawSubscription(): Promise<Subscription>;
  /** Whether the user agreed to the current AI provider list (P12-12), and the list. */
  getAiConsent(): Promise<AiConsent>;
  /** Records agreement to the list the user was shown (its version). */
  grantAiConsent(version: string): Promise<AiConsent>;
  /** Kicks off the self-service data-export archive (V2 §8.5). */
  requestDataExport(): Promise<DataExportStatus>;
  /** Polled while the archive builds, and the row's state on a cold open (V2 §8.5). */
  getDataExport(): Promise<DataExportStatus>;
  /** The audit trail behind the dashboard's "Activities" counter (V2 §7.2). */
  listActivity(): Promise<ActivityEntry[]>;
};

/**
 * Every mutation here returns the whole Profile, not the entry it touched: `completeness` and
 * `nextSteps` move on most edits, so a caller handed only the changed row would render a stale
 * meter and a stale next-step list.
 */
export type ProfileRepo = {
  getProfile(): Promise<Profile>;
  /** Marks a next-step as done and bumps completeness. Returns the updated profile. */
  completeNextStep(id: string): Promise<Profile>;
  /** Partial update from the preference pickers (availability, min salary, language, …). */
  updatePreferences(patch: Partial<ProfilePreferences>): Promise<Profile>;
  /** Identity fields from the "Edit profile" form (headline, location, years). */
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  /** Adds or replaces a role by id — one form serves both "Add" and "Edit". */
  upsertExperience(entry: Experience): Promise<Profile>;
  /** Drops a role from the timeline the whole product generates against (V2 §7.3). */
  removeExperience(id: string): Promise<Profile>;
  /** Adds or replaces an education entry by id — institution, degree, field, dates (V2 §7.3). */
  upsertEducation(entry: Education): Promise<Profile>;
  /** Drops an education entry by id (V2 §7.3). */
  removeEducation(id: string): Promise<Profile>;
  /** The whole skill set at once; the editor adds and removes chips against one list. */
  updateSkills(skills: string[]): Promise<Profile>;
  /** Adds or replaces a certification by id — name, issuer, date, expiry (V2 §7.3). */
  upsertCertification(entry: Certification): Promise<Profile>;
  /** Drops a certification by id (V2 §7.3). */
  removeCertification(id: string): Promise<Profile>;
  /** Adds or replaces one of the profile's links by id (V2 §7.3 personal info). */
  upsertLink(entry: ProfileLink): Promise<Profile>;
  /** Drops a profile link by id (V2 §7.3). */
  removeLink(id: string): Promise<Profile>;
  /**
   * Commits the accepted rows from a parsed upload (V2 §7.4 — nothing lands until the user
   * says so).
   */
  applyProfileDraft(draft: ProfileDraft): Promise<Profile>;
  /** Makes facts read from a resume the person's own word: one row, or a whole kind (§146.3). */
  confirmFacts(input: ConfirmFacts): Promise<Profile>;
  /** What the gap interview still has to ask (toreview §146.7). */
  getGapQuestions(): Promise<GapQuestion[]>;
  /** An answer or a skip. Answers with what's left to ask. */
  answerGap(id: string, answer: GapAnswer): Promise<GapQuestion[]>;
};

export type ExportFormat = 'pdf' | 'docx' | 'txt';

/**
 * An export (V2 §7.12, C-07). The backend renders the file on the worker and hands back a
 * presigned URL that expires within 15 minutes (`delivery: 'file'`); the device downloads it. The
 * mock data layer cannot render a file, so it still returns render inputs (`delivery: 'render'`)
 * that the device prints or writes through @/lib/exportFile.
 */
export type ResumeExport =
  | {
      delivery: 'file';
      format: ExportFormat;
      fileName: string;
      mimeType: string;
      url: string;
      /** ISO-8601; the link stops working after this. */
      expiresAt: string;
      /** What read back from the file (toreview §146.6). */
      receipt?: ExportReceipt;
    }
  | {
      delivery: 'render';
      format: ExportFormat;
      fileName: string;
      mimeType: string;
      html: string;
      text: string;
    };

/**
 * The hand-editable half of a cover letter. `getContent` returns either document kind, but the
 * section writers below are typed to the resume half, so the letter body gets its own patch
 * (V2 §7.10; §11 exposes `PUT /cover-letters/:id`).
 */
export type CoverLetterPatch = Partial<
  Pick<CoverLetterContent, 'greeting' | 'paragraphs' | 'signoff' | 'tone'>
>;

export type ResumesRepo = {
  list(): Promise<Resume[]>;
  get(id: string): Promise<Resume>;
  /** Starts an empty document the editor fills in by hand (V2 §7.11). */
  create(input: { title: string; docType: ResumeDocType }): Promise<Resume>;
  getScore(id: string): Promise<AtsScore>;
  getVersions(id: string): Promise<ResumeVersion[]>;
  /** What one version changed against the one before it, and why (toreview §146.5). */
  getVersionChanges(id: string, versionId: string): Promise<VersionChange[]>;
  /** The structured body the editor edits — never a rendered file (V2 §7.11). */
  getContent(id: string): Promise<DocumentContent>;
  /** Where each line of the current version came from (toreview §146.4). */
  getLineSources(id: string): Promise<LineSource[]>;
  /** Writes one section. Generic over the section so the value is typed to what is written. */
  updateSection<K extends ResumeSectionKey>(
    id: string,
    section: K,
    value: ResumeContent[K],
  ): Promise<DocumentContent>;
  /** The resume editor's whole document (toreview §124). */
  getDocument(id: string): Promise<ResumeDocument>;
  /**
   * Saves the whole document from the revision `baseRevision`. Refused with PRECONDITION_FAILED
   * when the body changed since that revision was read, so a save never writes over newer work.
   */
  saveDocument(id: string, write: ResumeDocumentWrite, baseRevision: string): Promise<ResumeDocument>;
  /** Saves a hand edit to a cover letter body (V2 §7.10; §11 `PUT /cover-letters/:id`). */
  updateLetter(id: string, patch: CoverLetterPatch): Promise<DocumentContent>;
  /** Re-runs the model over a single section, leaving the rest untouched (V2 §7.11). */
  regenerateSection(id: string, section: ResumeSectionKey): Promise<DocumentContent>;
  /**
   * "AI rewrite" (toreview §113): regenerates one section the way the user asked, from the
   * resume's own lines. The mock regenerates it as `regenerateSection` does.
   */
  rewriteSection(id: string, section: ResumeSectionKey, instruction: string): Promise<DocumentContent>;
  /** "Fit to one page" (toreview §113): the worker's outcome. The mock has no compiler. */
  fitToOnePage(id: string): Promise<ResumeFit>;
  /** Applies one quick win and re-scores; both move, so both come back (V2 §7.8). */
  applyAtsFix(id: string, itemId: string): Promise<{ content: DocumentContent; score: AtsScore }>;
  /** Rolls the document back to an earlier version, as a new current version (V2 §7.11). */
  restoreVersion(id: string, versionId: string): Promise<Resume>;
  /**
   * Answers one Zero Resume guess — save it as the real fact, or delete it (V2 §7.9). The last
   * answer opens the download gate and fills the profile with what was confirmed.
   */
  resolveZeroCheck(id: string, resolution: ZeroResolution): Promise<ZeroCheckResult>;
  duplicate(id: string): Promise<Resume>;
  rename(id: string, title: string): Promise<Resume>;
  /** Moves the "Base" flag to this resume. Returns the full list — two documents change. */
  setAsBase(id: string): Promise<Resume[]>;
  /**
   * The user confirms the current version is accurate, once per version, before its first export
   * (V2 §15 risk 2). Returns the document with `accuracyConfirmed` set.
   */
  confirmAccuracy(id: string): Promise<Resume>;
  /**
   * A PDF / DOCX / TXT of the current version (V2 §7.12). Throws `ExportBlockedError` while the
   * version is unconfirmed, a Zero Resume review is open, or the email is unverified, and
   * `PlanLockedError` for DOCX on the free plan.
   */
  export(id: string, format: ExportFormat): Promise<ResumeExport>;
  /** A view-only link to the current version (V2 §7.12). */
  shareLink(id: string): Promise<string>;
  /**
   * The typeset pages of a version (default: the current one), compiled by LaTeX on the server
   * (toreview §111). `structured` means there are none to show and the screen draws its own preview;
   * the mock always answers that.
   */
  preview(id: string, versionId?: string): Promise<ResumePreview>;
  /** Parses an uploaded resume into a document plus a profile draft to review (V2 §7.4). */
  importFromFile(file: JdFile): Promise<{ resume: Resume; draft: ProfileDraft }>;
  remove(id: string): Promise<void>;
};

export type JobsRepo = {
  list(filters: JobFilters, cursor?: string, sort?: JobSort): Promise<Page<Job>>;
  /** Total matches for a filter set, without paging — the filter sheet's live result count. */
  count(filters: JobFilters): Promise<number>;
  /** The Jobs tab's carousel: the best matches posted in the last two days, freshest first. */
  listTodaysPicks(): Promise<Job[]>;
  get(id: string): Promise<Job>;
  /** Tag-related roles at other companies — the "Similar jobs" rail on JOBS 05. */
  listSimilar(id: string, limit?: number): Promise<Job[]>;
  /** Every open role at one employer — the company screen's listings section. */
  listByCompany(company: string): Promise<Job[]>;
  /** Saved jobs sort by save order, deadline or salary; defaults to most recently saved. */
  listSaved(sort?: SavedJobsSort): Promise<Job[]>;
  /** Joined with the listing so the Applied tab never has to look jobs up itself. */
  listApplications(): Promise<ApplicationWithJob[]>;
  /**
   * Saves or unsaves a job (P11-04). Idempotent: repeating it changes nothing. Free saves up to 10
   * open listings (V2 §13.3); an 11th new save throws `PlanLockedError`, and saves already above
   * the cap stay.
   */
  setSaved(id: string, saved: boolean): Promise<Job>;
  /** Records that the candidate applied; NextKin never submits anything. Idempotent per job. */
  apply(id: string): Promise<Application>;
  /**
   * Starts "Did you apply?" for a job, or for the job a resume was made for, and returns it when it
   * should be asked now. Null when there is no job to ask about, or nothing left to ask.
   */
  askAboutApplication(target: ApplicationTarget): Promise<ApplicationAsk | null>;
  /** The asks waiting for the candidate, oldest first. */
  listApplicationAsks(): Promise<ApplicationAsk[]>;
  /** "Yes" adds it to the Applied list, "not yet" asks once more a day later, "no" ends it. */
  answerApplicationAsk(id: string, answer: ApplicationAnswer): Promise<void>;
  /** Records where an application has got to: the web board's "Update Status" (Figma 332:467). */
  updateApplicationStatus(id: string, status: ApplicationStatus, interviewAt?: string | null): Promise<Application>;
  /** "No news yet": answers a follow-up without moving the application. */
  checkInApplication(id: string): Promise<Application>;
  /** Home's "Top Job Matches": the open listings that best match the profile. */
  listPicks(): Promise<Job[]>;
  /** Reads a copied job link without keeping anything (TAILOR 00c). UNREADABLE_LINK if blocked. */
  readLink(url: string): Promise<JobLinkPreview>;
  /** Saves the job behind a copied link, adding it to NextKin first when needed. Idempotent. */
  importFromLink(url: string): Promise<Job>;
};

/** Usage events (owner, 2026-10-31): fire and forget, and a no-op on the mock. */
export type EventsRepo = {
  send(events: ProductEvent[]): Promise<void>;
};

export type NotificationsRepo = {
  /** Flat list, newest first. Grouping (Today / Yesterday / …) is a UI concern. */
  list(): Promise<Notification[]>;
  markRead(id: string): Promise<Notification>;
  markAllRead(): Promise<void>;
  remove(id: string): Promise<void>;
  getPrefs(): Promise<NotificationPrefs>;
  setPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
  /** The web board's channels and topics (Figma 247:1290). Mobile's NOTIF 04 keeps `getPrefs`. */
  getSettings(): Promise<NotificationSettings>;
  /** Replaces them whole: each switch sends the full set, so two quick flips can't lose one. */
  setSettings(settings: NotificationSettings): Promise<NotificationSettings>;
  /** "Reset to default" (247:1298): back to what a new account starts with. */
  resetSettings(): Promise<NotificationSettings>;
  /** This phone said yes to push. Repeating it is fine; a new account on the phone takes it over. */
  registerDevice(device: PushDevice): Promise<void>;
  /** This phone stops hearing, on signing out. */
  removeDevice(token: string): Promise<void>;
};

export type JdRepo = {
  /** Reads a pasted, uploaded or job-board JD into editable fields (V2 §7.5). */
  extract(input: JdInput): Promise<JdDraft>;
  /** Re-opens a saved extraction: the review screen and a generation both read it (V2 §7.5). */
  get(id: string): Promise<JdDraft>;
  /** Saves the review screen's edits; what the user confirms is what generation reads (§7.5). */
  update(id: string, patch: JdDraftPatch): Promise<JdDraft>;
  /**
   * Measures a resume against a job on NextKin (TAILOR 02, toreview §56): the ATS score for that
   * job, its keywords on and off the resume, and what to improve. Extracts the job's draft as a
   * side effect, so the tailoring run reads the same JD the comparison did.
   */
  compare(resumeId: string, jobId: string): Promise<TailorComparison>;
  /**
   * The same, against a job description the user brought (W-TAILOR 01 on a JD's page, toreview
   * §110): pasted, uploaded or linked. Engines only; the resume is its own yardstick.
   */
  compareToJd(resumeId: string, jdId: string): Promise<TailorComparison>;
  /**
   * "Add the result", drafted (toreview §129): the bullet `line` of a role, rewritten around a gap
   * for its real figure. `text` is the bullet as the screen shows it, for the plain draft.
   */
  draftFigure(resumeId: string, roleId: string, line: number, text: string): Promise<FigureDraft>;
  /** A job on NextKin, read once and reused (BUILD 04b reads it to compare with the profile). */
  forJob(jobId: string): Promise<JdDraft>;
  /**
   * How the profile matches a job description (its own page's match card): the listing match's
   * engine and fields. Null where there is nothing to score (no profile, not ready, the mock).
   */
  match(jdId: string): Promise<JdMatch | null>;
};

export type Unsubscribe = () => void;

/**
 * V2 §7.15 — practice sets once they exist. There is no `create`: a set is produced by
 * `GenerationsRepo.start({ kind: 'interview' })` finishing, so both modes run as the async job
 * the spec asks for and there is one progress screen. Marks persist here because the spec's
 * acceptance criterion is that they survive the session.
 */
export type InterviewRepo = {
  /** Every set, newest first. */
  list(): Promise<InterviewSet[]>;
  get(id: string): Promise<InterviewSet>;
  /** The set a finished run produced; null while the run is still in flight. */
  getByGeneration(generationId: string): Promise<InterviewSet | null>;
  /**
   * Persists a practice mark. Returns the WHOLE set: the counts on the card move with the mark,
   * so a caller handed only the question would draw a stale summary — the rule ProfileRepo states.
   */
  markQuestion(setId: string, questionId: string, mark: InterviewMark): Promise<InterviewSet>;
  /** Clears every mark, so a second pass starts clean. */
  resetMarks(setId: string): Promise<InterviewSet>;
  remove(id: string): Promise<void>;
};

export type AssistantSendInput = {
  text: string;
  resumeId?: string;
  /** What the web composer attached (772:165), kept on the user's turn. */
  attachments?: AssistantAttachment[];
};

/**
 * V2 §7.16 — read-and-advise only. Deliberately no verb that writes user data: no regenerate,
 * no edit, no delete of a message, nothing that touches a resume or the profile. The interface
 * having no way to is the cheapest proof of the "cannot take actions" acceptance criterion.
 */
export type AssistantRepo = {
  /** The one conversation the account keeps (§7.16: history persists per user). */
  getConversation(): Promise<AssistantConversation>;
  /**
   * Appends the user's turn and the assistant's, and returns both. An allowed reply arrives
   * `status: 'streaming'` with empty text and `subscribe` fills it; a refusal arrives whole.
   */
  send(input: AssistantSendInput): Promise<{ user: AssistantMessage; reply: AssistantMessage }>;
  /** Emits the reply as it grows, until it reaches a terminal status. */
  subscribe(messageId: string, onChange: (message: AssistantMessage) => void): Unsubscribe;
  clear(): Promise<AssistantConversation>;
  /** The web History (767:2): the current chat and the earlier ones, newest first. */
  listThreads(): Promise<AssistantThreadSummary[]>;
  /** Makes an earlier chat the current one; the chat it replaces goes back into the history. */
  openThread(id: string): Promise<AssistantConversation>;
  /** Files the current chat in the history, if it has anything in it, and starts an empty one. */
  startNew(): Promise<AssistantConversation>;
};

export type GenerationsRepo = {
  /** The in-flight generation, if any. */
  getActive(): Promise<Generation | null>;
  /** One run, so a result screen opened from a deep link can stand on its own (V2 §7.6). */
  get(id: string): Promise<Generation>;
  /** Every run, newest first. History reads the activity trail, not this — a run writes two entries there. */
  list(): Promise<Generation[]>;
  /**
   * Starts a run and creates the document it will fill. Idempotency is the caller's (V2 §11 puts
   * an Idempotency-Key on POST /generations).
   */
  start(input: GenerationInput): Promise<Generation>;
  /** Re-runs a failed generation against the same input (V2 §7.6). */
  retry(id: string): Promise<Generation>;
  /**
   * Stops a run before it finishes (ATS 02's Cancel). Nothing was produced, so the allowance it
   * took is handed back and any document it opened for itself is removed.
   */
  cancel(id: string): Promise<Generation>;
  /** Emits on every progress tick until the generation reaches a terminal status. */
  subscribe(id: string, onChange: (generation: Generation) => void): Unsubscribe;
};

/**
 * Help content, the two legal documents, and the one message the app can send (PROFILE 02 Support rows; V2 §8.5).
 * Reference data on the way in, a single write on the way out.
 */
export type SupportRepo = {
  /** The whole FAQ. Search and topic filtering are the screen's job — see the repo's header. */
  listFaq(): Promise<FaqItem[]>;
  /** One legal document, with the "last updated" stamp §8.5 requires it to carry. */
  getLegal(doc: LegalDocKey): Promise<LegalDoc>;
  /** Sends a support message; the reply goes to the account address. */
  submitTicket(input: TicketInput): Promise<SupportTicket>;
};

/** The candidate's own files (Figma 286:2026). Uploads and downloads wait for storage. */
export type DocumentsRepo = {
  /** The whole library, newest first. Filtering and sorting are the screen's job. */
  list(): Promise<CareerDocument[]>;
};

/** The web Insights page (461:14): read-only analytics over a window of the user's activity. */
export type InsightsRepo = {
  get(range: InsightsRange): Promise<CareerInsights>;
};

export type Repos = {
  user: UserRepo;
  profile: ProfileRepo;
  resumes: ResumesRepo;
  jobs: JobsRepo;
  notifications: NotificationsRepo;
  events: EventsRepo;
  jd: JdRepo;
  generations: GenerationsRepo;
  support: SupportRepo;
  interview: InterviewRepo;
  assistant: AssistantRepo;
  documents: DocumentsRepo;
  insights: InsightsRepo;
};
