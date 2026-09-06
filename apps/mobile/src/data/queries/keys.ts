import type { JobFilters, JobSort, SavedJobsSort } from '@/data/models';

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
    /** The document body the editor edits, separate from the Resume metadata in `detail`. */
    content: (id: string) => ['resumes', 'content', id] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    lists: () => ['jobs', 'list'] as const,
    list: (filters: JobFilters, sort: JobSort = 'relevance') =>
      ['jobs', 'list', filters, sort] as const,
    /** Sort-independent: the filter sheet previews how many jobs match, not their order. */
    count: (filters: JobFilters) => ['jobs', 'count', filters] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    similar: (id: string) => ['jobs', 'similar', id] as const,
    /** Every saved-jobs order, for one invalidation that sweeps them all. */
    savedAll: () => ['jobs', 'saved'] as const,
    /** The sort is in the key: two orders are two cached lists, not one list re-fetched. */
    saved: (sort: SavedJobsSort = 'recent') => ['jobs', 'saved', sort] as const,
    picks: () => ['jobs', 'picks'] as const,
    todaysPicks: () => ['jobs', 'todays-picks'] as const,
    applications: () => ['jobs', 'applications'] as const,
    byCompany: (company: string) => ['jobs', 'by-company', company] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    prefs: () => ['notifications', 'prefs'] as const,
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
  jd: {
    all: ['jd'] as const,
    detail: (id: string) => ['jd', 'detail', id] as const,
  },
} as const;
