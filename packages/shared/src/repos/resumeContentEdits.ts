import type { AtsCheckItem, ProfileLink, ResumeContent, ResumeSectionKey } from '@/data/models';

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
        experience: content.experience.map((role) => ({ ...role, needsReview: false })),
      };
    case 'projects':
      return {
        ...content,
        projects: content.projects.map((project) => ({ ...project, needsReview: false })),
      };
    case 'education':
      return {
        ...content,
        education: content.education.map((entry) => ({ ...entry, needsReview: false })),
      };
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
      return { ...content, summary: fresh.summary === content.summary ? rotated : fresh.summary };
    }
    case 'skills':
      return { ...content, skills: rotate(fresh.skills) };
    case 'experience':
      return {
        ...content,
        experience: fresh.experience.map((role) => ({ ...role, bullets: rotate(role.bullets) })),
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
      return { ...content, education: fresh.education.map((entry) => ({ ...entry })) };
  }
}

/** The keyword out of `Missing: "A/B testing"` — the label is the only place it is recorded. */
const quoted = (label: string): string | undefined => /"([^"]+)"/.exec(label)?.[1];

/**
 * Countable and generic on purpose: the fix has to give the §7.8 `content_gap` check a bullet
 * with a number in it without inventing a result the profile cannot back (§7.9).
 */
const QUANTIFIED_BULLET =
  'Tracked the outcome of 3 shipped projects, reporting before-and-after metrics';

/** Patches the document for one quick win, where that item's `section` says the fix lands. */
export function patchForFix(
  content: ResumeContent,
  item: AtsCheckItem,
  links: ProfileLink[],
): ResumeContent {
  if (item.id.startsWith('kw_miss_')) {
    const keyword = quoted(item.label);
    if (!keyword) throw new NotFoundError('AtsFix', item.id);
    if (content.skills.includes(keyword)) return content;
    return { ...content, skills: [...content.skills, keyword] };
  }
  if (item.id === 'content_gap') {
    const [first, ...rest] = content.experience;
    if (!first) throw new NotFoundError('AtsFix', item.id);
    return {
      ...content,
      experience: [{ ...first, bullets: [...first.bullets, QUANTIFIED_BULLET] }, ...rest],
    };
  }
  if (item.id === 'portfolio') {
    const portfolio = links.find((link) => link.kind === 'portfolio' || link.label === 'Portfolio');
    // The §7.8 rule that governs keywords governs links too: with no portfolio on the profile
    // there is nothing the product may put in the document.
    if (!portfolio) throw new NotFoundError('AtsFix', item.id);
    return { ...content, links: [...(content.links ?? []), portfolio.url] };
  }
  throw new NotFoundError('AtsFix', item.id);
}
