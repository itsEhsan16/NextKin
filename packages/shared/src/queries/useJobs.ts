import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  EMPTY_JOB_FILTERS,
  jobFit,
  type FitJob,
  type FitLabel,
  type ApplicationAnswer,
  type ApplicationStatus,
  type ApplicationTarget,
  type ApplicationWithJob,
  type Job,
  type JobFilters,
  type JobSort,
} from '../models';
import { repos } from '../repos';

import { findCachedJob } from './jobCache';
import { qk } from './keys';
import { track } from './track';
import { useProfile } from './useProfile';

/** Paged job search. Flatten with `data.pages.flatMap((page) => page.items)`. */
export function useJobs(filters: JobFilters = EMPTY_JOB_FILTERS, sort: JobSort = 'relevance') {
  return useInfiniteQuery({
    queryKey: qk.jobs.list(filters, sort),
    queryFn: ({ pageParam }) => repos.jobs.list(filters, pageParam, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Filters and the search term are part of the key; keep showing the last results while the
    // next set loads so the list never blinks back to skeletons mid-typing.
    placeholderData: keepPreviousData,
  });
}

/**
 * How many jobs a filter set would return. Drives the filter sheet's "Show N jobs" CTA, which
 * previews a draft the user has not applied yet — so it keeps the last count on screen rather
 * than blanking the button while the next one resolves.
 */
export function useJobCount(filters: JobFilters) {
  return useQuery({
    queryKey: qk.jobs.count(filters),
    queryFn: () => repos.jobs.count(filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * The whole unfiltered catalogue, every page read in turn. The web's Location and Company
 * filters offer what it holds. It has its own key: reading the unfiltered search list for this
 * used to share the visible list's cache entry whenever no filter was set, so loading its second
 * page grew the list on screen by itself (`toreview.md` §84).
 */
export function useJobCatalogue() {
  return useQuery({
    queryKey: qk.jobs.catalogue(),
    queryFn: async () => {
      const jobs: Job[] = [];
      let cursor: string | undefined;
      do {
        const page = await repos.jobs.list(EMPTY_JOB_FILTERS, cursor, 'relevance');
        jobs.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return jobs;
    },
  });
}

export type UseJobOptions = {
  /**
   * Show the copy a job list already holds (picks, a search page, saved) while the detail loads,
   * so opening a job from a list paints its page at once rather than a skeleton. Opt-in: only a
   * screen that renders a list item's fields faithfully should take it.
   */
  seedFromLists?: boolean;
};

export function useJob(id: string, { seedFromLists = false }: UseJobOptions = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.jobs.detail(id),
    queryFn: () => repos.jobs.get(id),
    enabled: id.length > 0,
    placeholderData: seedFromLists ? () => findCachedJob(queryClient, id) : undefined,
  });
}

/** "Similar jobs" on the detail screen. */
export function useSimilarJobs(id: string) {
  return useQuery({
    queryKey: qk.jobs.similar(id),
    queryFn: () => repos.jobs.listSimilar(id),
    enabled: id.length > 0,
  });
}

/** Every open role at one employer — the company screen's listings section. */
export function useJobsByCompany(company: string) {
  return useQuery({
    queryKey: qk.jobs.byCompany(company),
    queryFn: () => repos.jobs.listByCompany(company),
    enabled: company.length > 0,
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: qk.jobs.saved(),
    queryFn: () => repos.jobs.listSaved(),
  });
}

export function useApplications() {
  return useQuery({
    queryKey: qk.jobs.applications(),
    queryFn: () => repos.jobs.listApplications(),
  });
}

/** Jobs tab "Today's picks" carousel — editorial, distinct from Home's match-ranked picks. */
export function useTodaysPicks() {
  return useQuery({
    queryKey: qk.jobs.todaysPicks(),
    queryFn: () => repos.jobs.listTodaysPicks(),
  });
}

export function useJobPicks() {
  return useQuery({
    queryKey: qk.jobs.picks(),
    queryFn: () => repos.jobs.listPicks(),
  });
}

/** What Home's picks left out for clashing with the candidate's preferences, and why. */
export function useHiddenPicks() {
  return useQuery({
    queryKey: qk.jobs.hiddenPicks(),
    queryFn: () => repos.jobs.getHiddenPicks(),
  });
}

/** How one job sits with their preferences. Nothing yet while the profile is loading. */
export function useJobFit(job: FitJob | undefined): FitLabel[] {
  const preferences = useProfile().data?.preferences;
  return useMemo(() => (job && preferences ? jobFit(job, preferences) : []), [job, preferences]);
}

/** "I applied", said directly: the Applied tab gains the row. NextKin submits nothing. */
export function useApplyToJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.jobs.apply(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
  });
}

/** The "Did you apply?" questions due now, oldest first. */
export function useApplicationAsks() {
  return useQuery({
    queryKey: qk.jobs.applicationAsks(),
    queryFn: () => repos.jobs.listApplicationAsks(),
  });
}

/** Starts "Did you apply?" after a download or a trip to the employer's page. */
export function useAskAboutApplication() {
  return useMutation({
    mutationFn: (target: ApplicationTarget) => repos.jobs.askAboutApplication(target),
    onSuccess: (_ask, target) => {
      if ('jobId' in target) track('apply_opened');
    },
  });
}

export function useAnswerApplicationAsk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: ApplicationAnswer }) =>
      repos.jobs.answerApplicationAsk(id, answer),
    onSuccess: (_result, { answer }) => track('apply_answered', { answer }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.jobs.applicationAsks() }),
        queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
      ]),
  });
}

/**
 * "Update Status" on the web Applications board (332:467). Optimistic, like saving a job: the
 * list shows the new status straight away, rolls back if the call fails, and settles against the
 * store either way.
 */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      interviewAt,
    }: {
      id: string;
      status: ApplicationStatus;
      interviewAt?: string | null;
    }) => repos.jobs.updateApplicationStatus(id, status, interviewAt),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: qk.jobs.applications() });
      const previous = queryClient.getQueryData<ApplicationWithJob[]>(qk.jobs.applications());
      queryClient.setQueryData<ApplicationWithJob[]>(qk.jobs.applications(), (rows) =>
        rows?.map((row) =>
          row.application.id === id ? { ...row, application: { ...row.application, status } } : row,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(qk.jobs.applications(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
  });
}

/** "No news yet": a follow-up answered, with nothing moved. */
export function useCheckInApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.jobs.checkInApplication(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
  });
}

/** TAILOR 00c: the job a copied link names, read before anything is kept. */
export function useJobLinkPreview(url: string) {
  return useQuery({
    queryKey: qk.jobs.link(url),
    queryFn: () => repos.jobs.readLink(url),
    enabled: url.length > 0,
    // A link that will not read is not worth asking again while the dialog is up.
    retry: false,
  });
}

/** "Tailor my resume to it" / "Just save the job": the link's job lands in Saved jobs. */
export function useImportJobLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => repos.jobs.importFromLink(url),
    onSuccess: (job) => queryClient.setQueryData(qk.jobs.detail(job.id), job),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.savedAll() }),
  });
}
