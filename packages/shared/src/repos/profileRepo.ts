import { newId, simulate } from '../mock';
import { withConfirmedFacts, type Profile } from '../models';

import { clone, findOrThrow, type MockStore, NotFoundError } from './state';
import type { ProfileRepo } from './types';

/** Each completed next-step moves the completeness meter by this much (capped at 1). */
const STEP_WEIGHT = 0.14;

/**
 * Every save moves the meter too, one weight per entry: adding a role, degree, certification,
 * link or skill adds it, removing one subtracts it, and filling a blank identity field counts as
 * an addition (editing one that was already filled does not). Clamped to 0..1 and rounded to two
 * places the way `completeNextStep` rounds. The meter is the profile's only standing confirmation
 * that an edit landed, so no save leaves it still.
 */
const SAVE_WEIGHT = 0.02;

/** The "Add skills" chip on the completeness card — writing the skill list is what answers it. */
const SKILLS_STEP_ID = 'step_skills';

/** The identity fields `ProfilePatch` writes, and the ones completeness counts. */
const IDENTITY_FIELDS = ['headline', 'location', 'yearsExperience'] as const;

export const nudge = (completeness: number, entries: number): number =>
  Math.min(1, Math.max(0, Math.round((completeness + entries * SAVE_WEIGHT) * 100) / 100));

const filled = (value: string | number | undefined): boolean =>
  value != null && String(value).trim().length > 0;

const identityCount = (profile: Profile): number =>
  IDENTITY_FIELDS.filter((key) => filled(profile[key])).length;

const normalise = (value: string): string => value.trim().toLowerCase();

/** Copies before storing: a caller keeping a reference must not be able to edit the database. */
const withFreshIds = <T extends { id: string }>(entries: T[], prefix: string): T[] =>
  entries.map((entry) => ({ ...clone(entry), id: newId(prefix) }));

/**
 * One form serves "Add" and "Edit": a known id replaces its entry where it already sits, so the
 * list never reorders under an edit; an empty or unknown id is a new row appended with a fresh id.
 */
function upsertEntry<T extends { id: string }>(
  entries: T[],
  entry: T,
  prefix: string,
): { entries: T[]; added: boolean } {
  const exists = entry.id.length > 0 && entries.some((item) => item.id === entry.id);
  if (!exists)
    return {
      entries: [...entries, ...withFreshIds([entry], prefix)],
      added: true,
    };
  return {
    entries: entries.map((item) => (item.id === entry.id ? clone(entry) : item)),
    added: false,
  };
}

function removeEntry<T extends { id: string }>(entries: T[], id: string, entity: string): T[] {
  findOrThrow(entries, id, entity);
  return entries.filter((item) => item.id !== id);
}

export function createMockProfileRepo(store: MockStore): ProfileRepo {
  /** Writes the profile back and hands the caller a copy, never the stored object. */
  const save = (next: Profile): Profile => {
    store.state.profile = next;
    return clone(next);
  };

  return {
    getProfile: () => simulate(() => clone(store.state.profile)),

    completeNextStep: (id) =>
      simulate(() => {
        const { profile } = store.state;
        const step = profile.nextSteps.find((item) => item.id === id);
        if (!step) throw new NotFoundError('NextStep', id);
        return save({
          ...profile,
          nextSteps: profile.nextSteps.filter((item) => item.id !== id),
          completeness: Math.min(1, Math.round((profile.completeness + STEP_WEIGHT) * 100) / 100),
        });
      }),

    updatePreferences: (patch) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          preferences: { ...profile.preferences, ...patch },
        });
      }),

    updateProfile: (patch) =>
      simulate(() => {
        const { profile } = store.state;
        const next: Profile = { ...profile, ...patch };
        return save({
          ...next,
          completeness: nudge(profile.completeness, identityCount(next) - identityCount(profile)),
        });
      }),

    upsertExperience: (entry) =>
      simulate(() => {
        const { profile } = store.state;
        const { entries, added } = upsertEntry(profile.experiences, { ...entry, provenance: 'user' }, 'exp');
        return save({
          ...profile,
          experiences: entries,
          completeness: nudge(profile.completeness, added ? 1 : 0),
        });
      }),

    removeExperience: (id) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          experiences: removeEntry(profile.experiences, id, 'Experience'),
          completeness: nudge(profile.completeness, -1),
        });
      }),

    upsertEducation: (entry) =>
      simulate(() => {
        const { profile } = store.state;
        const { entries, added } = upsertEntry(profile.education, { ...entry, provenance: 'user' }, 'edu');
        return save({
          ...profile,
          education: entries,
          completeness: nudge(profile.completeness, added ? 1 : 0),
        });
      }),

    removeEducation: (id) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          education: removeEntry(profile.education, id, 'Education'),
          completeness: nudge(profile.completeness, -1),
        });
      }),

    updateSkills: (skills) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          skills: clone(skills),
          // The chip promises the list; once it has been written, the step has been answered.
          nextSteps: profile.nextSteps.filter((step) => step.id !== SKILLS_STEP_ID),
          completeness: nudge(profile.completeness, skills.length - profile.skills.length),
        });
      }),

    upsertCertification: (entry) =>
      simulate(() => {
        const { profile } = store.state;
        const { entries, added } = upsertEntry(profile.certifications, { ...entry, provenance: 'user' }, 'cert');
        return save({
          ...profile,
          certifications: entries,
          completeness: nudge(profile.completeness, added ? 1 : 0),
        });
      }),

    removeCertification: (id) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          certifications: removeEntry(profile.certifications, id, 'Certification'),
          completeness: nudge(profile.completeness, -1),
        });
      }),

    upsertLink: (entry) =>
      simulate(() => {
        const { profile } = store.state;
        const { entries, added } = upsertEntry(profile.links, entry, 'link');
        return save({
          ...profile,
          links: entries,
          completeness: nudge(profile.completeness, added ? 1 : 0),
        });
      }),

    removeLink: (id) =>
      simulate(() => {
        const { profile } = store.state;
        return save({
          ...profile,
          links: removeEntry(profile.links, id, 'ProfileLink'),
          completeness: nudge(profile.completeness, -1),
        });
      }),

    // V2 §7.4 — commits the accepted rows of a parsed upload. A row the profile already holds is
    // skipped rather than duplicated: a role matches on company AND title, a degree on
    // institution, a skill on its lower-cased text. Everything kept is appended with a fresh id.
    applyProfileDraft: (draft) =>
      simulate(() => {
        const { profile } = store.state;
        const read = <T extends object>(row: T) => ({ ...row, provenance: 'parsed_confirmed' as const });
        const known = new Set(profile.skills.map(normalise));
        const skills = (draft.skills ?? []).filter((skill) => {
          const key = normalise(skill);
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        const experiences = (draft.experiences ?? []).filter(
          (entry) =>
            !profile.experiences.some(
              (item) =>
                normalise(item.company) === normalise(entry.company) &&
                normalise(item.title) === normalise(entry.title),
            ),
        );
        const education = (draft.education ?? []).filter(
          (entry) =>
            !profile.education.some(
              (item) => normalise(item.institution) === normalise(entry.institution),
            ),
        );
        const certifications = draft.certifications ?? [];
        const headline = draft.headline ?? profile.headline;
        const added =
          (!filled(profile.headline) && filled(headline) ? 1 : 0) +
          skills.length +
          experiences.length +
          education.length +
          certifications.length;
        return save({
          ...profile,
          headline,
          skills: [...profile.skills, ...clone(skills)],
          ...(skills.length > 0
            ? { skillsToConfirm: [...(profile.skillsToConfirm ?? []), ...clone(skills)] }
            : {}),
          experiences: [...profile.experiences, ...withFreshIds(experiences.map(read), 'exp')],
          education: [...profile.education, ...withFreshIds(education.map(read), 'edu')],
          certifications: [...profile.certifications, ...withFreshIds(certifications.map(read), 'cert')],
          completeness: nudge(profile.completeness, added),
        });
      }),

    confirmFacts: (input) =>
      simulate(() => {
        const { profile } = store.state;
        if (input.id !== undefined && input.kind !== 'skills') {
          const rows = input.kind === 'experience' ? profile.experiences : input.kind === 'education' ? profile.education : profile.certifications;
          findOrThrow<{ id: string }>(rows, input.id, 'Fact');
        }
        return save(withConfirmedFacts(profile, input));
      }),
  };
}
