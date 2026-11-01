import type { JobFilters, JobSort, SavedJobsSort } from '../models';

/**
 * Query key factory. Every key is a tuple starting with the aggregate name so
 * `invalidateQueries({ queryKey: qk.jobs.all })` sweeps the whole aggregate.
 */
export const qk = {
  user: {
    all: ['user'] as const,
    me: () => ['user', 'me'] as const,
    subscription: () => ['user', 'subscription'] as const,
    dashboardStats: () => ['user', 'dashboard-stats'] as const,
    plans: () => ['user', 'plans'] as const,
    activity: () => ['user', 'activity'] as const,
    dataExport: () => ['user', 'data-export'] as const,
    security: () => ['user', 'security'] as const,
    appSettings: () => ['user', 'app-settings'] as const,
    privacySettings: () => ['user', 'privacy-settings'] as const,
    billing: () => ['user', 'billing'] as const,
    aiConsent: () => ['user', 'ai-consent'] as const,
    connectedAccounts: () => ['user', 'connected-accounts'] as const,
  },
  profile: {
    all: ['profile'] as const,
    me: () => ['profile', 'me'] as const,
  },
  resumes: {
    all: ['resumes'] as const,
    list: () => ['resumes', 'list'] as const,
    detail: (id: string) => ['resumes', 'detail', id] as const,
    score: (id: string) => ['resumes', 'score', id] as const,
    versions: (id: string) => ['resumes', 'versions', id] as const,
    /** Where each line of the current version came from (toreview §146.4). */
    sources: (id: string) => ['resumes', 'sources', id] as const,
    /** The document body the editor edits, separate from the Resume metadata in `detail`. */
    content: (id: string) => ['resumes', 'content', id] as const,
    /** The typeset pages of a version; `current` for whichever version is current. */
    preview: (id: string, versionId?: string) => ['resumes', 'preview', id, versionId ?? 'current'] as const,
    /** The editor's whole document (toreview §124). */
    document: (id: string) => ['resumes', 'document', id] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    lists: () => ['jobs', 'list'] as const,
    list: (filters: JobFilters, sort: JobSort = 'relevance') =>
      ['jobs', 'list', filters, sort] as const,
    /** Sort-independent: the filter sheet previews how many jobs match, not their order. */
    count: (filters: JobFilters) => ['jobs', 'count', filters] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    /**
     * Every listed job, unfiltered: the options the web's Location and Company filters offer.
     * Outside `lists()` on purpose, since `findCachedJob` reads everything there as search pages.
     */
    catalogue: () => ['jobs', 'catalogue'] as const,
    similar: (id: string) => ['jobs', 'similar', id] as const,
    /** Every saved-jobs order, for one invalidation that sweeps them all. */
    savedAll: () => ['jobs', 'saved'] as const,
    /** The sort is in the key: two orders are two cached lists, not one list re-fetched. */
    saved: (sort: SavedJobsSort = 'recent') => ['jobs', 'saved', sort] as const,
    picks: () => ['jobs', 'picks'] as const,
    todaysPicks: () => ['jobs', 'todays-picks'] as const,
    applications: () => ['jobs', 'applications'] as const,
    applicationAsks: () => ['jobs', 'application-asks'] as const,
    byCompany: (company: string) => ['jobs', 'by-company', company] as const,
    /** A copied link as read (TAILOR 00c); nothing is kept until it is imported. */
    link: (url: string) => ['jobs', 'link', url] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    prefs: () => ['notifications', 'prefs'] as const,
    settings: () => ['notifications', 'settings'] as const,
  },
  generations: {
    all: ['generations'] as const,
    active: () => ['generations', 'active'] as const,
    list: () => ['generations', 'list'] as const,
    detail: (id: string) => ['generations', 'detail', id] as const,
  },
  support: {
    all: ['support'] as const,
    faq: () => ['support', 'faq'] as const,
    legal: (doc: string) => ['support', 'legal', doc] as const,
  },
  sharedReport: (token: string) => ['shared-report', token] as const,
  serviceStatus: () => ['service-status'] as const,
  interview: {
    all: ['interview'] as const,
    list: () => ['interview', 'list'] as const,
    detail: (id: string) => ['interview', 'detail', id] as const,
    byGeneration: (generationId: string) => ['interview', 'by-generation', generationId] as const,
  },
  insights: {
    all: ['insights'] as const,
    range: (range: string) => ['insights', range] as const,
  },
  assistant: {
    all: ['assistant'] as const,
    conversation: () => ['assistant', 'conversation'] as const,
    /** Every in-flight reply, for one sweep. */
    messages: () => ['assistant', 'message'] as const,
    /** One reply as it streams — its own key, so a token never re-renders the transcript. */
    message: (id: string) => ['assistant', 'message', id] as const,
    /** The web History list (767:2). */
    threads: () => ['assistant', 'threads'] as const,
  },
  jd: {
    all: ['jd'] as const,
    detail: (id: string) => ['jd', 'detail', id] as const,
    /** A resume measured against one job (TAILOR 02). */
    compare: (resumeId: string, jobId: string) => ['jd', 'compare', resumeId, jobId] as const,
    /** A job on NextKin, read once (BUILD 04b). */
    forJob: (jobId: string) => ['jd', 'job', jobId] as const,
    /** How the profile matches one JD (its page's match card). */
    match: (jdId: string) => ['jd', 'match', jdId] as const,
    /** A resume measured against a JD the user brought (W-TAILOR 01 on a JD). */
    compareJd: (resumeId: string, jdId: string) => ['jd', 'compareJd', resumeId, jdId] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: () => ['documents', 'list'] as const,
  },
} as const;
