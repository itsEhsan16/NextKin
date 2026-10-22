import type { AtsFix, ResumeContent, ResumeSectionKey } from '../models';

import { NotFoundError } from './state';

/**
 * NextKin V2 spec §7.8 and §7.9 — the pure edits behind the section editor.
 *
 * Split out of `resumeContentRepo` so the repo file is store access and the mock-mode wrapper,
 * and this one is the document maths: what a regenerate rewrites, what a quick win patches, and
 * which review flags an edit clears. None of it touches the store, so it is testable on its own.
 */

export const nowIso = (): string => new Date().toISOString();

/**
 * One section written back. The cast is TS's computed-key limit, not a widening: `value` is
 * already typed `ResumeContent[K]`.
 */
export const withSection = <K extends ResumeSectionKey>(
  content: ResumeContent,
  section: K,
  value: ResumeContent[K],
): ResumeContent => ({ ...content, [section]: value }) as ResumeContent;

/**
 * Zero Resume Mode flags what it assumed (§7.9); typing over an entry by hand confirms it. Only
 * the section the caller replaced loses its flags — the rest of the document is still unreviewed.
 */
export function confirmReviewed(content: ResumeContent, section: ResumeSectionKey): ResumeContent {
  switch (section) {
    case 'experience':
      return {
        ...content,
        experience: content.experience.map((role) => ({
          ...role,
          needsReview: false,
        })),
      };
    case 'projects':
      return {
        ...content,
        projects: content.projects.map((project) => ({
          ...project,
          needsReview: false,
        })),
      };
    case 'education':
      return {
        ...content,
        education: content.education.map((entry) => ({
          ...entry,
          needsReview: false,
        })),
      };
    case 'skills': {
      // A Zero Resume draft's skill claims are answered by saving the list by hand: the ones
      // still on it are kept, the ones taken off are removed — the check sheet's two answers.
      const review = content.review;
      if (!review || review.pendingSkills.length === 0) return content;
      const dropped = review.pendingSkills.filter((skill) => !content.skills.includes(skill));
      return {
        ...content,
        review: {
          ...review,
          pendingSkills: [],
          removedSkills: [...review.removedSkills, ...dropped],
        },
      };
    }
    default:
      return content;
  }
}

const rotate = <T>(items: T[]): T[] => {
  const [first, ...rest] = items;
  return first === undefined ? items : [...rest, first];
};

/** Sentence split that keeps its punctuation, so a rotated summary still reads as prose. */
const sentences = (text: string): string[] =>
  text.match(/[^.!?]+[.!?]*/g)?.map((part) => part.trim()) ?? [text];

/**
 * A regenerate has to read as a new draft, and §7.9 forbids inventing a fact the profile cannot
 * back — so the mock re-runs the builder and, where that hands back what is already on the page,
 * reorders what is there rather than writing a new claim.
 */
export function regenerated(
  content: ResumeContent,
  fresh: ResumeContent,
  section: ResumeSectionKey,
): ResumeContent {
  switch (section) {
    case 'summary': {
      const rotated = rotate(sentences(content.summary)).join(' ');
      return {
        ...content,
        summary: fresh.summary === content.summary ? rotated : fresh.summary,
      };
    }
    case 'skills':
      return { ...content, skills: rotate(fresh.skills) };
    case 'experience':
      return {
        ...content,
        experience: fresh.experience.map((role) => ({
          ...role,
          bullets: rotate(role.bullets),
        })),
      };
    case 'projects':
      return {
        ...content,
        projects: fresh.projects.map((project) => ({
          ...project,
          bullets: rotate(project.bullets),
        })),
      };
    case 'certifications':
      return { ...content, certifications: rotate(fresh.certifications) };
    case 'education':
      return {
        ...content,
        education: fresh.education.map((entry) => ({ ...entry })),
      };
  }
}

/**
 * Applies a typed fix (C-10). Only `surface_backed_skill` exists here: the profile backs the skill,
 * so it goes onto the role the profile shows it in (as that role's evidence) or into the skills
 * section, in the JD's wording. Nothing invents a bullet or inserts a skill the profile lacks.
 */
export function patchForFix(content: ResumeContent, fix: AtsFix): ResumeContent {
  const skill = fix.skill;
  if (fix.type !== 'surface_backed_skill' || !fix.insertable || !skill) throw new NotFoundError('AtsFix', fix.id);
  if (fix.roleId) {
    const target = content.experience.find((role) => role.roleId === fix.roleId || role.id === fix.roleId);
    if (target) {
      return {
        ...content,
        experience: content.experience.map((role) =>
          role === target && !(role.skills ?? []).includes(skill) ? { ...role, skills: [...(role.skills ?? []), skill] } : role,
        ),
      };
    }
  }
  if (content.skills.includes(skill)) return content;
  return { ...content, skills: [...content.skills, skill] };
}
