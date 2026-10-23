import { MockError, newId, simulate } from '../mock';
import type {
  Education,
  Experience,
  Profile,
  Resume,
  ResumeContent,
  ZeroResolution,
} from '../models';
import { formatZeroPeriod, isBlank, parseZeroPeriod, zeroDateIso, zeroProgress } from '../models';

import { bumpVersion, saveContent } from './documentWrites';
import { nudge } from './profileRepo';
import { clone, findOrThrow, type MockStore, NotFoundError } from './state';
import type { ResumesRepo } from './types';

/**
 * Zero Resume Mode's review flow (V2 §7.9, ZERO 03–05): one guess answered at a time, each answer
 * a new version (§7.11). The last answer opens the download gate and fills the Candidate Profile
 * with what the user confirmed, so they leave with a resume and a real profile (§7.9's last
 * acceptance criterion). Spread into `resumesRepo.ts`, like the editing and export slices.
 */
export type ZeroReviewRepo = Pick<ResumesRepo, 'resolveZeroCheck'>;

/** §7.9: "a blank can't stay". The sheet says so first; this is the backstop. */
const refuseBlank = (what: string): never => {
  throw new MockError('ZERO_BLANK', `Add the real ${what} — a blank can't stay.`);
};

const NOTE: Record<ZeroResolution['kind'], string> = {
  role: 'Checked a role',
  skill: 'Checked a skill',
  education: 'Checked education',
};

/** The document after one answer. Pure, so the rules are testable without the store. */
export function applyZeroResolution(
  content: ResumeContent,
  resolution: ZeroResolution,
): ResumeContent {
  const review = content.review;
  if (!review) throw new NotFoundError('ZeroDraft', content.resumeId);

  switch (resolution.kind) {
    case 'role': {
      findOrThrow(content.experience, resolution.roleId, 'ContentRole');
      if (resolution.remove) {
        return {
          ...content,
          experience: content.experience.filter((role) => role.id !== resolution.roleId),
        };
      }
      if (isBlank(resolution.title)) refuseBlank('job title');
      if (isBlank(resolution.company)) refuseBlank('company');
      return {
        ...content,
        experience: content.experience.map((role) =>
          role.id === resolution.roleId
            ? {
                ...role,
                title: resolution.title.trim(),
                company: resolution.company.trim(),
                period: formatZeroPeriod(resolution.start, resolution.end),
                needsReview: false,
              }
            : role,
        ),
      };
    }

    case 'skill': {
      if (!review.pendingSkills.includes(resolution.skill)) {
        throw new NotFoundError('ZeroSkill', resolution.skill);
      }
      const pendingSkills = review.pendingSkills.filter((skill) => skill !== resolution.skill);
      if (resolution.remove) {
        return {
          ...content,
          skills: content.skills.filter((skill) => skill !== resolution.skill),
          review: {
            ...review,
            pendingSkills,
            removedSkills: [...review.removedSkills, resolution.skill],
          },
        };
      }
      const name = resolution.name.trim();
      if (name.length === 0) refuseBlank('skill');
      // A renamed claim takes the guess's place in the list; a name already there is not doubled.
      const renamed = content.skills.map((skill) => (skill === resolution.skill ? name : skill));
      const skills = renamed.filter((skill, index) => renamed.indexOf(skill) === index);
      return { ...content, skills, review: { ...review, pendingSkills } };
    }

    case 'education': {
      findOrThrow(content.education, resolution.entryId, 'ContentEducation');
      if (resolution.remove) {
        return {
          ...content,
          education: content.education.filter((entry) => entry.id !== resolution.entryId),
        };
      }
      if (isBlank(resolution.degree)) refuseBlank('degree');
      if (isBlank(resolution.institution)) refuseBlank('school');
      return {
        ...content,
        education: content.education.map((entry) =>
          entry.id === resolution.entryId
            ? {
                ...entry,
                degree: resolution.degree.trim(),
                institution: resolution.institution.trim(),
                period: formatZeroPeriod(resolution.start, resolution.end),
                needsReview: false,
              }
            : entry,
        ),
      };
    }
  }
}

/**
 * The confirmed draft written into the profile, the way a parsed upload is (§7.4): each role and
 * school once (a re-run does not double them), the skills merged in. The completeness meter
 * moves one step per entry added, as every other profile save does.
 */
function fillProfile(profile: Profile, content: ResumeContent): Profile {
  const experiences = [...profile.experiences];
  const education = [...profile.education];
  let added = 0;

  for (const role of content.experience) {
    const span = parseZeroPeriod(role.period);
    if (!span) continue;
    const startDate = zeroDateIso(span.start);
    const known = experiences.some(
      (entry) =>
        entry.company === role.company &&
        entry.title === role.title &&
        entry.startDate === startDate,
    );
    if (known) continue;
    const entry: Experience = {
      id: newId('exp'),
      company: role.company,
      title: role.title,
      startDate,
      ...(span.end === 'present' ? {} : { endDate: zeroDateIso(span.end) }),
      current: span.end === 'present',
      skills: [],
    };
    experiences.push(entry);
    added += 1;
  }

  for (const school of content.education) {
    const span = parseZeroPeriod(school.period);
    if (!span) continue;
    const startDate = zeroDateIso(span.start);
    const known = education.some(
      (entry) => entry.institution === school.institution && entry.startDate === startDate,
    );
    if (known) continue;
    const entry: Education = {
      id: newId('edu'),
      institution: school.institution,
      degree: school.degree,
      startDate,
      ...(span.end === 'present' ? {} : { endDate: zeroDateIso(span.end) }),
      current: span.end === 'present',
    };
    education.push(entry);
    added += 1;
  }

  const skills = [...profile.skills];
  for (const skill of content.skills) {
    if (!skills.some((known) => known.toLowerCase() === skill.toLowerCase())) {
      skills.push(skill);
      added += 1;
    }
  }

  return {
    ...profile,
    experiences,
    education,
    skills,
    completeness: nudge(profile.completeness, added),
  };
}

export function createZeroReviewRepo(store: MockStore): ZeroReviewRepo {
  return {
    resolveZeroCheck: (id, resolution) =>
      simulate(() => {
        const resume = findOrThrow(store.state.resumes, id, 'Resume');
        const content = store.state.contents[id];
        if (!content || content.kind !== 'resume' || !content.review) {
          throw new NotFoundError('ZeroDraft', id);
        }

        const next = applyZeroResolution(content, resolution);
        const { versionId } = bumpVersion(store, resume, NOTE[resolution.kind]);
        const stored = saveContent(store, id, next, versionId);
        const finished = zeroProgress(stored).left === 0;

        if (finished) {
          // The gate opens on the document's metadata too, so the editor and the library agree.
          store.state.resumes = store.state.resumes.map((item) => {
            if (item.id !== id) return item;
            const { needsReview: _cleared, ...rest } = item;
            return rest;
          });
          store.state.profile = fillProfile(store.state.profile, stored);
        }

        const current: Resume = findOrThrow(store.state.resumes, id, 'Resume');
        return { content: clone(stored), resume: clone(current), finished };
      }),
  };
}
