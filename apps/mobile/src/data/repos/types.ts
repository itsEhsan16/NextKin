import type {
  ActivityEntry,
  Application,
  ApplicationWithJob,
  AtsScore,
  Certification,
  CoverLetterContent,
  DashboardStats,
  DataExportStatus,
  DocumentContent,
  Education,
  Experience,
  FaqItem,
  Generation,
  GenerationInput,
  JdDraft,
  JdDraftPatch,
  JdFile,
  JdInput,
  Job,
  JobFilters,
  LegalDoc,
  LegalDocKey,
  JobSort,
  Notification,
  NotificationPrefs,
  Plan,
  PlanId,
  Profile,
  ProfileDraft,
  ProfileLink,
  ProfilePatch,
  ProfilePreferences,
  Resume,
  ResumeContent,
  ResumeDocType,
  ResumeSectionKey,
  ResumeVersion,
  SavedJobsSort,
  Subscription,
  SupportTicket,
  TicketInput,
  User,
} from '@/data/models';

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
  /** Irreversible account deletion (V2 §8.5). */
  deleteAccount(): Promise<void>;
  /** The purchasable SKUs behind the plan screen (V2 §13.2). */
  listPlans(): Promise<Plan[]>;
  /** Moves the subscription onto a plan and returns the new entitlements (V2 §13). */
  upgrade(planId: PlanId): Promise<Subscription>;
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
};

export type ExportFormat = 'pdf' | 'docx' | 'txt';

/**
 * Render inputs, not a file: the device writes or prints it through @/lib/exportFile, because a
 * repo cannot touch the filesystem and the real API will return a presigned URL instead.
 */
export type ResumeExport = {
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
  /** The structured body the editor edits — never a rendered file (V2 §7.11). */
  getContent(id: string): Promise<DocumentContent>;
  /** Writes one section. Generic over the section so the value is typed to what is written. */
  updateSection<K extends ResumeSectionKey>(
    id: string,
    section: K,
    value: ResumeContent[K],
  ): Promise<DocumentContent>;
  /** Saves a hand edit to a cover letter body (V2 §7.10; §11 `PUT /cover-letters/:id`). */
  updateLetter(id: string, patch: CoverLetterPatch): Promise<DocumentContent>;
  /** Re-runs the model over a single section, leaving the rest untouched (V2 §7.11). */
  regenerateSection(id: string, section: ResumeSectionKey): Promise<DocumentContent>;
  /** Applies one quick win and re-scores; both move, so both come back (V2 §7.8). */
  applyAtsFix(id: string, itemId: string): Promise<{ content: DocumentContent; score: AtsScore }>;
  /** Rolls the document back to an earlier version, as a new current version (V2 §7.11). */
  restoreVersion(id: string, versionId: string): Promise<Resume>;
  duplicate(id: string): Promise<Resume>;
  rename(id: string, title: string): Promise<Resume>;
  /** Moves the "Base" flag to this resume. Returns the full list — two documents change. */
  setAsBase(id: string): Promise<Resume[]>;
  /** Render inputs for PDF / DOCX / TXT; the device does the writing (V2 §7.12). */
  export(id: string, format: ExportFormat): Promise<ResumeExport>;
  /** A view-only link to the current version (V2 §7.12). */
  shareLink(id: string): Promise<string>;
  /** Parses an uploaded resume into a document plus a profile draft to review (V2 §7.4). */
  importFromFile(file: JdFile): Promise<{ resume: Resume; draft: ProfileDraft }>;
  remove(id: string): Promise<void>;
};

export type JobsRepo = {
  list(filters: JobFilters, cursor?: string, sort?: JobSort): Promise<Page<Job>>;
  /** Total matches for a filter set, without paging — the filter sheet's live result count. */
  count(filters: JobFilters): Promise<number>;
  /** Editorial carousel on the Jobs tab, distinct from Home's match-ranked picks. */
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
  toggleSave(id: string): Promise<Job>;
  /** Submits an application (NOTIF 07's post-apply flow). Idempotent per job. */
  apply(id: string): Promise<Application>;
  listPicks(): Promise<Job[]>;
};

export type NotificationsRepo = {
  /** Flat list, newest first. Grouping (Today / Yesterday / …) is a UI concern. */
  list(): Promise<Notification[]>;
  markRead(id: string): Promise<Notification>;
  markAllRead(): Promise<void>;
  remove(id: string): Promise<void>;
  getPrefs(): Promise<NotificationPrefs>;
  setPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
};

export type JdRepo = {
  /** Reads a pasted, uploaded or job-board JD into editable fields (V2 §7.5). */
  extract(input: JdInput): Promise<JdDraft>;
  /** Re-opens a saved extraction: the review screen and a generation both read it (V2 §7.5). */
  get(id: string): Promise<JdDraft>;
  /** Saves the review screen's edits; what the user confirms is what generation reads (§7.5). */
  update(id: string, patch: JdDraftPatch): Promise<JdDraft>;
};

export type Unsubscribe = () => void;

export type GenerationsRepo = {
  /** The in-flight generation, if any. */
  getActive(): Promise<Generation | null>;
  /** One run, so a result screen opened from a deep link can stand on its own (V2 §7.6). */
  get(id: string): Promise<Generation>;
  /** Every run, newest first — the generation rows behind History (V2 §7.2). */
  list(): Promise<Generation[]>;
  /**
   * Starts a run and creates the document it will fill. Idempotency is the caller's (V2 §11 puts
   * an Idempotency-Key on POST /generations).
   */
  start(input: GenerationInput): Promise<Generation>;
  /** Re-runs a failed generation against the same input (V2 §7.6). */
  retry(id: string): Promise<Generation>;
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

export type Repos = {
  user: UserRepo;
  profile: ProfileRepo;
  resumes: ResumesRepo;
  jobs: JobsRepo;
  notifications: NotificationsRepo;
  jd: JdRepo;
  generations: GenerationsRepo;
  support: SupportRepo;
};
