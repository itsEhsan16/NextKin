import { buildInterviewSet, newId } from '@/data/mock';
import type { ActivityEntry, Generation, InterviewSet } from '@/data/models';

import { jdDraftFor } from './generationOutput';
import { type MockStore } from './state';

/**
 * NextKin V2 spec §7.15 — what "ready" means for an interview run.
 *
 * The one kind in the pipeline that leaves no document: it writes a practice set instead, and
 * deliberately does NOT touch the source resume — re-stamping its `updatedAt` would float it to
 * the top of the library and of Home's progress card for a run that changed nothing about it.
 *
 * Split from `generationCompletion` the way `generationOutput` is: that file commits documents,
 * this one commits sets, and the ticker calls whichever the kind needs.
 */

/**
 * Skills the score could not back. §7.15: "questions are never generated about skills the
 * Timeline Validation Engine flagged or removed" — the mock has no timeline engine, so the
 * unsupported keyword gaps on the score panel stand in for what the document was not allowed
 * to claim.
 */
function excludedSkillsFor(store: MockStore, resumeId: string | undefined): string[] {
  const score = resumeId ? store.state.atsScores[resumeId] : undefined;
  if (!score) return [];
  return score.sections
    .flatMap((section) => section.items)
    .filter((item) => item.supported === false)
    .map((item) => /"([^"]+)"/.exec(item.label)?.[1] ?? item.label);
}

export function completeInterviewSet(store: MockStore, generation: Generation): InterviewSet {
  const resumeId = generation.resumeId;
  const resume = resumeId ? store.state.resumes.find((item) => item.id === resumeId) : undefined;
  const content = resumeId ? store.state.contents[resumeId] : undefined;
  const draft = jdDraftFor(store, generation);
  const now = new Date().toISOString();

  // Regenerating produces a NEW set and never deletes the old one (§7.15 AC). The newest earlier
  // set for the same target is recorded so the list can caption it "Earlier set".
  const earlier = store.state.interviewSets.find((set) =>
    resume
      ? set.resumeId === resume.id
      : set.source === 'standalone' && set.roleTitle === generation.title,
  );

  const set = buildInterviewSet({
    setId: newId('int'),
    now,
    generationId: generation.id,
    resume,
    content: content?.kind === 'resume' ? content : undefined,
    draft,
    excludedSkills: excludedSkillsFor(store, resumeId),
    roleTitle: generation.title,
    ...(earlier ? { regeneratedFromId: earlier.id } : {}),
  });
  store.state.interviewSets = [set, ...store.state.interviewSets];

  const counts = set.questions.length;
  const entry: ActivityEntry = {
    id: newId('act'),
    kind: 'interview',
    title: `Wrote **${counts} practice questions** for ${set.title}`,
    detail:
      set.source === 'standalone'
        ? 'Generic set — not tailored to a job description'
        : 'Drawn from your resume and the job description',
    createdAt: now,
    deepLink: `/interview/${set.id}`,
    ...(set.resumeId ? { resumeId: set.resumeId } : {}),
    ...(set.jobId ? { jobId: set.jobId } : {}),
  };
  store.state.activity = [entry, ...store.state.activity];
  store.state.dashboardStats = {
    ...store.state.dashboardStats,
    activitiesCount: store.state.dashboardStats.activitiesCount + 1,
  };
  return set;
}
