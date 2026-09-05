import type { JdDraft, JdDraftPatch } from '@/data/models';

import type { SkillGroupKey } from './components/JdSkillGroup';

/**
 * The rules behind the three chip groups on the JD review screen (V2 §7.5): which list a group
 * names, and what a patch looks like when a chip is added, moved or taken out.
 *
 * Pure, and kept out of the screen: "the same skill must not sit in both lists" is a rule about
 * the extraction rather than about the page that edits it.
 */

export const skillsIn = (draft: JdDraft, group: SkillGroupKey): readonly string[] =>
  group === 'required'
    ? draft.requiredSkills
    : group === 'preferred'
      ? draft.preferredSkills
      : draft.tools;

const patchFor = (group: SkillGroupKey, next: string[]): JdDraftPatch =>
  group === 'required'
    ? { requiredSkills: next }
    : group === 'preferred'
      ? { preferredSkills: next }
      : { tools: next };

const has = (list: readonly string[], skill: string): boolean =>
  list.some((entry) => entry.toLowerCase() === skill.toLowerCase());

export type AddSkillResult = { patch: JdDraftPatch } | { refused: string };

/**
 * Appends an entry, or says why it was not appended. Required and preferred are the same question
 * asked twice: the same skill in both would undo the split §7.5 asks the screen to maintain, so
 * the other list is checked too and the chip's own menu is what moves it across.
 */
export function addSkill(draft: JdDraft, group: SkillGroupKey, skill: string): AddSkillResult {
  if (has(skillsIn(draft, group), skill)) return { refused: 'Already in this list.' };
  if (group === 'required' && has(draft.preferredSkills, skill)) {
    return { refused: 'Already a preferred skill — move it from there.' };
  }
  if (group === 'preferred' && has(draft.requiredSkills, skill)) {
    return { refused: 'Already a required skill — move it from there.' };
  }
  return { patch: patchFor(group, [...skillsIn(draft, group), skill]) };
}

export function removeSkill(draft: JdDraft, group: SkillGroupKey, skill: string): JdDraftPatch {
  return patchFor(
    group,
    skillsIn(draft, group).filter((entry) => entry !== skill),
  );
}

/**
 * Moves a skill to the other group. One patch carries both lists: the chip has to leave one and
 * land in the other in the same optimistic write, or it blinks off the page in between.
 */
export function moveSkill(
  draft: JdDraft,
  group: 'required' | 'preferred',
  skill: string,
): JdDraftPatch {
  const required = draft.requiredSkills.filter((entry) => entry !== skill);
  const preferred = draft.preferredSkills.filter((entry) => entry !== skill);
  return group === 'required'
    ? { requiredSkills: required, preferredSkills: [...preferred, skill] }
    : { preferredSkills: preferred, requiredSkills: [...required, skill] };
}
