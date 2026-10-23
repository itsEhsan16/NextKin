import { newId } from '../mock';
import type {
  ActivityEntry,
  GenerationInput,
  GenerationKind,
  JdDraft,
  Job,
  Resume,
} from '../models';
import { GENERATION_KIND_LABEL, TAILOR_TARGET_PAGES } from '../models';

import { GENERATION_ACTIVITY_KIND } from './generationCompletion';
import { nudge } from './profileRepo';
import type { MockStore } from './state';

/**
 * NextKin V2 spec §7.6 — the other end of the pipeline: everything `generationsRepo.start` has
 * to put in the store before the first tick. Split out of the repo so that file stays the
 * ticker and the contract; `generationCompletion` is its mirror image at the 'ready' end.
 */

/** Named after nothing in particular, because neither the JD nor the job named the role. */
const UNTITLED: Record<GenerationKind, string> = {
  resume: 'Untitled resume',
  cover_letter: 'Untitled cover letter',
  zero_resume: 'First draft resume',
  ats_check: 'ATS check',
  interview: 'Interview questions',
};

/** "Stripe — Senior Product Designer": the shape `resumesFixture` already lists documents in. */
function shellTitle(
  input: GenerationInput,
  draft: JdDraft | undefined,
  job: Job | undefined,
): string {
  const explicit = input.title?.trim();
  if (explicit) return explicit;
  const company = draft?.company ?? job?.company;
  const role = draft?.title ?? job?.title ?? input.zero?.targetTitle;
  if (company && role) return `${company} — ${role}`;
  return role ?? company ?? UNTITLED[input.kind];
}

/**
 * The document a run fills, created queued rather than after the fact: the Resumes library, the
 * progress card and the History row all point at it from the moment the run starts, so it has to
 * exist before the first tick. Its one version carries "Generating…" until completion rewrites
 * the body.
 */
export function createGenerationShell(
  store: MockStore,
  input: GenerationInput,
  draft: JdDraft | undefined,
  job: Job | undefined,
  now: string,
): Resume {
  const versionId = newId('ver');
  const linkedJobId = input.jobId ?? draft?.jobId ?? job?.id;
  const targetCompany = draft?.company ?? job?.company;
  const targetRole = draft?.title ?? job?.title ?? input.zero?.targetTitle;

  const resume: Resume = {
    id: newId('res'),
    title: shellTitle(input, draft, job),
    docType: input.kind === 'cover_letter' ? 'cover_letter' : 'resume',
    createdAt: now,
    updatedAt: now,
    versionCount: 1,
    currentVersionId: versionId,
    status: 'queued',
    tags: [],
    // Spread rather than assign undefined: the store round-trips through JSON, which drops
    // undefined-valued keys, so an unknown link has to be an absent key here too.
    ...(linkedJobId ? { linkedJobId } : {}),
    ...(targetCompany ? { targetCompany } : {}),
    ...(targetRole ? { targetRole } : {}),
    // A tailoring run trims the source to two pages (toreview §56: "3 pages, trimmed to 2").
    ...(input.tailor?.sourcePages != null
      ? { pageCount: Math.min(input.tailor.sourcePages, TAILOR_TARGET_PAGES) }
      : {}),
  };

  store.state.resumes = [resume, ...store.state.resumes];
  store.state.resumeVersions = [
    ...store.state.resumeVersions,
    {
      id: versionId,
      resumeId: resume.id,
      version: 1,
      createdAt: now,
      changeNote: 'Generating…',
    },
  ];
  return resume;
}

/**
 * The V2 §13.3 meters. Nothing throws when a quota is spent: §13.5 gates in the UI *before* the
 * work begins, so a repo that threw here would force every Phase 9B screen to handle an error
 * the screen has already prevented — and would leave the mock unable to demo a run at all once
 * the seeded free plan runs out.
 */
export function bumpGenerationUsage(store: MockStore, kind: GenerationKind): void {
  const usage = { ...store.state.subscription.usage };
  if (kind === 'resume' || kind === 'zero_resume') {
    usage.generationsUsed += 1;
    usage.resumesUsed += 1;
  } else if (kind === 'cover_letter') {
    usage.coverLettersUsed += 1;
  } else if (kind === 'ats_check') {
    // Optional meters — absent from the seeded free plan, so the first run starts the count.
    usage.atsChecksUsed = (usage.atsChecksUsed ?? 0) + 1;
  } else {
    usage.interviewSetsUsed = (usage.interviewSetsUsed ?? 0) + 1;
  }
  store.state.subscription = { ...store.state.subscription, usage };
}

/**
 * BUILD 04c: "Anything you add is saved to your profile too." The skills the user said yes to
 * join the profile when the build starts, once each, so the resume and the profile agree.
 */
export function addBuildSkills(store: MockStore, added: readonly string[]): void {
  const { profile } = store.state;
  const skills = [...profile.skills];
  for (const skill of added) {
    if (!skills.some((known) => known.toLowerCase() === skill.toLowerCase())) skills.push(skill);
  }
  if (skills.length === profile.skills.length) return;
  store.state.profile = {
    ...profile,
    skills,
    completeness: nudge(profile.completeness, skills.length - profile.skills.length),
  };
}

/** The reverse of `bumpGenerationUsage`, for a run stopped before it produced anything. */
export function refundGenerationUsage(store: MockStore, kind: GenerationKind): void {
  const usage = { ...store.state.subscription.usage };
  const down = (value: number | undefined) => Math.max(0, (value ?? 0) - 1);
  if (kind === 'resume' || kind === 'zero_resume') {
    usage.generationsUsed = down(usage.generationsUsed);
    usage.resumesUsed = down(usage.resumesUsed);
  } else if (kind === 'cover_letter') {
    usage.coverLettersUsed = down(usage.coverLettersUsed);
  } else if (kind === 'ats_check') {
    usage.atsChecksUsed = down(usage.atsChecksUsed);
  } else {
    usage.interviewSetsUsed = down(usage.interviewSetsUsed);
  }
  store.state.subscription = { ...store.state.subscription, usage };
}

/** History records the run at both ends, so a failed run still leaves a trace of being asked for. */
function startedTitle(kind: GenerationKind, resume: Resume | undefined, title?: string): string {
  if (!resume && kind === 'interview' && title)
    return `Writing **interview questions** for **${title}**`;
  if (!resume) return `Started **${GENERATION_KIND_LABEL[kind]}**`;
  if (kind === 'ats_check') return `Running an **ATS check** on **${resume.title}**`;
  if (kind === 'interview') return `Writing **interview questions** for **${resume.title}**`;
  return `Generating **${resume.title}**`;
}

export function appendStartActivity(
  store: MockStore,
  input: GenerationInput,
  resume: Resume | undefined,
  jobId: string | undefined,
  now: string,
): void {
  const entry: ActivityEntry = {
    id: newId('act'),
    kind: GENERATION_ACTIVITY_KIND[input.kind],
    title: startedTitle(input.kind, resume, input.title),
    detail: GENERATION_KIND_LABEL[input.kind],
    createdAt: now,
    // A document run links to the document it is filling. An interview run links nowhere yet:
    // its set does not exist until completion, which writes the entry that points at it.
    ...(resume && input.kind !== 'interview'
      ? { deepLink: `/resumes/${resume.id}` as const, resumeId: resume.id }
      : resume
        ? { resumeId: resume.id }
        : {}),
    ...(jobId ? { jobId } : {}),
  };
  store.state.activity = [entry, ...store.state.activity];
  store.state.dashboardStats = {
    ...store.state.dashboardStats,
    activitiesCount: store.state.dashboardStats.activitiesCount + 1,
  };
}
