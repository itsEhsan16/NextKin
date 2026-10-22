import {
  companyFromHost,
  extractJdDraft,
  linkHost,
  MockError,
  newId,
  SKILL_DICTIONARY,
  titleFromPath,
} from '../mock';
import type { JdDraft, Job, JobLinkPreview, RemoteType } from '../models';

import type { MockStore } from './state';

/**
 * TAILOR 00c: a job link the user copied, read and — on "Tailor my resume to it" or "Just save
 * the job" — added to their saved jobs (owner, 2026-10-04: a copied link becomes a job on
 * NextKin, so Tailor runs on it as on any other). The server would fetch the page; the mock reads
 * the address (`mock/jobLink.ts`) and the stand-in link body the JD extractor already uses.
 */

const norm = (value: string): string => value.trim().toLowerCase();

/** Some sites block reading (BUILD 05b): the mock refuses any host with "blocked" in it. */
function assertReadable(url: string): void {
  if (/blocked/i.test(linkHost(url))) {
    throw new MockError('UNREADABLE_LINK', "We couldn't read that job page");
  }
}

function readDraft(store: MockStore, url: string): JdDraft {
  return extractJdDraft(
    { source: 'link', url },
    {
      jobs: store.state.jobs,
      dictionary: SKILL_DICTIONARY,
      id: newId('jd'),
      now: new Date().toISOString(),
    },
  );
}

/** What the link names: the address first, then what the page body says, then the host. */
function namesOf(store: MockStore, url: string): { title: string; company: string } {
  const draft = readDraft(store, url);
  const host = linkHost(url);
  return {
    title: titleFromPath(url) ?? draft.title,
    company: companyFromHost(host) ?? draft.company ?? host,
  };
}

/** The job already behind this link: one added from it before, or the same role on NextKin. */
function knownJob(store: MockStore, url: string): Job | undefined {
  const added = store.state.jobs.find((job) => job.sourceUrl === url);
  if (added) return added;
  const { title, company } = namesOf(store, url);
  return store.state.jobs.find(
    (job) =>
      !job.sourceUrl && norm(job.company) === norm(company) && norm(job.title) === norm(title),
  );
}

export function readJobLink(store: MockStore, url: string): JobLinkPreview {
  assertReadable(url);
  const known = knownJob(store, url);
  const names = known ? { title: known.title, company: known.company } : namesOf(store, url);
  return { url, host: linkHost(url), ...names };
}

const remoteFrom = (text: string): RemoteType =>
  /\bremote\b/i.test(text) ? 'remote' : /\bhybrid\b/i.test(text) ? 'hybrid' : 'onsite';

function jobFromLink(store: MockStore, url: string, now: string): Job {
  const draft = readDraft(store, url);
  const { title, company } = namesOf(store, url);
  const skills = [...draft.requiredSkills, ...draft.preferredSkills];
  return {
    id: newId('job'),
    title,
    company,
    // The page names neither; the job screen leaves out what it does not know.
    companyIndustry: '',
    companySize: '',
    companyWebsite: linkHost(url),
    location: draft.location ?? '',
    remote: remoteFrom(draft.rawText),
    employmentType: draft.employmentType ?? 'full_time',
    experienceLevel: draft.experienceLevel ?? 'mid',
    postedAt: now,
    source: 'manual',
    sourceUrl: url,
    description: draft.rawText.split('\n').find((line) => line.trim().length > 40) ?? '',
    responsibilities: draft.responsibilities,
    requirements: skills,
    tags: skills,
    isSaved: true,
    savedAt: now,
    isPick: false,
    isTodaysPick: false,
    relevanceRank: Number.MAX_SAFE_INTEGER,
  };
}

/** Saves the job behind the link, adding it first when NextKin does not have it. Idempotent. */
export function importJobLink(store: MockStore, url: string): Job {
  assertReadable(url);
  const now = new Date().toISOString();
  const known = knownJob(store, url);
  if (known) {
    if (known.isSaved) return known;
    const saved: Job = { ...known, isSaved: true, savedAt: now };
    store.state.jobs = store.state.jobs.map((job) => (job.id === saved.id ? saved : job));
    return saved;
  }
  const job = jobFromLink(store, url, now);
  store.state.jobs = [...store.state.jobs, job];
  return job;
}
