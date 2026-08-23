import type {
  ApplicationWithJob,
  DashboardStats,
  AtsScore,
  Generation,
  Job,
  JobFilters,
  JobSort,
  Notification,
  NotificationPrefs,
  Profile,
  Resume,
  ResumeVersion,
  Subscription,
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
};

export type ProfileRepo = {
  getProfile(): Promise<Profile>;
  /** Marks a next-step as done and bumps completeness. Returns the updated profile. */
  completeNextStep(id: string): Promise<Profile>;
};

export type ResumesRepo = {
  list(): Promise<Resume[]>;
  get(id: string): Promise<Resume>;
  getScore(id: string): Promise<AtsScore>;
  getVersions(id: string): Promise<ResumeVersion[]>;
  duplicate(id: string): Promise<Resume>;
  rename(id: string, title: string): Promise<Resume>;
  remove(id: string): Promise<void>;
};

export type JobsRepo = {
  list(filters: JobFilters, cursor?: string, sort?: JobSort): Promise<Page<Job>>;
  /** Editorial carousel on the Jobs tab, distinct from Home's match-ranked picks. */
  listTodaysPicks(): Promise<Job[]>;
  get(id: string): Promise<Job>;
  listSaved(): Promise<Job[]>;
  /** Joined with the listing so the Applied tab never has to look jobs up itself. */
  listApplications(): Promise<ApplicationWithJob[]>;
  toggleSave(id: string): Promise<Job>;
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

export type Unsubscribe = () => void;

export type GenerationsRepo = {
  /** The in-flight generation, if any. */
  getActive(): Promise<Generation | null>;
  /** Emits on every progress tick until the generation reaches a terminal status. */
  subscribe(id: string, onChange: (generation: Generation) => void): Unsubscribe;
};

export type Repos = {
  user: UserRepo;
  profile: ProfileRepo;
  resumes: ResumesRepo;
  jobs: JobsRepo;
  notifications: NotificationsRepo;
  generations: GenerationsRepo;
};
