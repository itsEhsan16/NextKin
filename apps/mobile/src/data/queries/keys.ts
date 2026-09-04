import type { JobFilters, JobSort } from '@/data/models';

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
    saved: () => ['jobs', 'saved'] as const,
    picks: () => ['jobs', 'picks'] as const,
    todaysPicks: () => ['jobs', 'todays-picks'] as const,
    applications: () => ['jobs', 'applications'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    prefs: () => ['notifications', 'prefs'] as const,
  },
  generations: {
    all: ['generations'] as const,
    active: () => ['generations', 'active'] as const,
  },
} as const;
