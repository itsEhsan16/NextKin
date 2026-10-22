import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  Certification,
  Education,
  Experience,
  Profile,
  ProfileDraft,
  ProfileLink,
  ProfilePatch,
} from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * Every profile write is the same optimistic dance on one cache entry, so it is written once.
 * `apply` is the only thing that differs: a pure function from the profile on screen to the
 * profile the user just asked for.
 *
 * These are optimistic rather than write-through because every entry form (phase 9F) navigates
 * back on save — the row behind the sheet has to be right before the latency resolves, or the
 * list visibly re-sorts a beat after the screen has already gone.
 *
 * The repo answers with the whole Profile because `completeness` and `nextSteps` move on most
 * edits, and no optimistic guess should try to predict the meter: onSuccess writes the server's
 * value over the guess, and onSettled sweeps the aggregate.
 */
function profileMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<Profile>,
  apply: (previous: Profile, vars: TVars) => Profile,
) {
  return function useProfileWrite() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      onMutate: async (vars: TVars) => {
        // First, always: an in-flight profile refetch that lands after the write below would
        // silently undo it.
        await queryClient.cancelQueries({ queryKey: qk.profile.me() });
        const previous = queryClient.getQueryData<Profile>(qk.profile.me());
        queryClient.setQueryData<Profile>(qk.profile.me(), (old) => (old ? apply(old, vars) : old));
        return { previous };
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) queryClient.setQueryData(qk.profile.me(), context.previous);
      },
      onSuccess: (profile) => {
        queryClient.setQueryData(qk.profile.me(), profile);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: qk.profile.all }),
    });
  };
}

/**
 * One form serves "Add" and "Edit": a known id replaces its entry in place so the list never
 * reorders under an edit; a blank or unknown id appends. The repo assigns the real id.
 */
const upsertBy = <T extends { id: string }>(entries: T[], entry: T): T[] =>
  entry.id.length > 0 && entries.some((item) => item.id === entry.id)
    ? entries.map((item) => (item.id === entry.id ? entry : item))
    : [...entries, entry];

const removeById = <T extends { id: string }>(entries: T[], id: string): T[] =>
  entries.filter((item) => item.id !== id);

const normalise = (value: string): string => value.trim().toLowerCase();

/**
 * Mirrors the repo's de-duplication so the review screen does not flash rows the server is about
 * to drop: a skill matches on its text, a role on company AND title, a degree on institution.
 */
function applyDraft(previous: Profile, draft: ProfileDraft): Profile {
  const known = new Set(previous.skills.map(normalise));
  const skills = (draft.skills ?? []).filter((skill) => {
    const key = normalise(skill);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  const experiences = (draft.experiences ?? []).filter(
    (entry) =>
      !previous.experiences.some(
        (item) =>
          normalise(item.company) === normalise(entry.company) &&
          normalise(item.title) === normalise(entry.title),
      ),
  );
  const education = (draft.education ?? []).filter(
    (entry) =>
      !previous.education.some(
        (item) => normalise(item.institution) === normalise(entry.institution),
      ),
  );
  return {
    ...previous,
    headline: draft.headline ?? previous.headline,
    skills: [...previous.skills, ...skills],
    experiences: [...previous.experiences, ...experiences],
    education: [...previous.education, ...education],
    certifications: [...previous.certifications, ...(draft.certifications ?? [])],
  };
}

/** Adds or replaces a role on the timeline the whole product generates against (V2 §7.3). */
export const useUpsertExperience = profileMutation(
  (entry: Experience) => repos.profile.upsertExperience(entry),
  (previous, entry) => ({
    ...previous,
    experiences: upsertBy(previous.experiences, entry),
  }),
);

export const useRemoveExperience = profileMutation(
  (id: string) => repos.profile.removeExperience(id),
  (previous, id) => ({
    ...previous,
    experiences: removeById(previous.experiences, id),
  }),
);

export const useUpsertEducation = profileMutation(
  (entry: Education) => repos.profile.upsertEducation(entry),
  (previous, entry) => ({
    ...previous,
    education: upsertBy(previous.education, entry),
  }),
);

export const useRemoveEducation = profileMutation(
  (id: string) => repos.profile.removeEducation(id),
  (previous, id) => ({
    ...previous,
    education: removeById(previous.education, id),
  }),
);

/** The whole skill set at once — the editor adds and removes chips against one list. */
export const useUpdateSkills = profileMutation(
  (skills: string[]) => repos.profile.updateSkills(skills),
  (previous, skills) => ({ ...previous, skills }),
);

export const useUpsertCertification = profileMutation(
  (entry: Certification) => repos.profile.upsertCertification(entry),
  (previous, entry) => ({
    ...previous,
    certifications: upsertBy(previous.certifications, entry),
  }),
);

export const useRemoveCertification = profileMutation(
  (id: string) => repos.profile.removeCertification(id),
  (previous, id) => ({
    ...previous,
    certifications: removeById(previous.certifications, id),
  }),
);

export const useUpsertLink = profileMutation(
  (entry: ProfileLink) => repos.profile.upsertLink(entry),
  (previous, entry) => ({
    ...previous,
    links: upsertBy(previous.links, entry),
  }),
);

export const useRemoveLink = profileMutation(
  (id: string) => repos.profile.removeLink(id),
  (previous, id) => ({ ...previous, links: removeById(previous.links, id) }),
);

/** Identity fields from the "Edit profile" form (headline, location, years). */
export const useUpdateProfile = profileMutation(
  (patch: ProfilePatch) => repos.profile.updateProfile(patch),
  (previous, patch) => ({ ...previous, ...patch }),
);

/** Commits the accepted rows of a parsed upload — nothing lands until the user says so (§7.4). */
export const useApplyProfileDraft = profileMutation(
  (draft: ProfileDraft) => repos.profile.applyProfileDraft(draft),
  applyDraft,
);
