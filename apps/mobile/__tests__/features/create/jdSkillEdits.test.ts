import { jdDraftsFixture } from '@/data/mock';
import type { JdDraft } from '@/data/models';
import { addSkill, moveSkill, removeSkill, skillsIn } from '@/features/create/jdSkillEdits';

/**
 * The rules behind the JD review screen's three chip groups (V2 §7.5). Nine other modules cite
 * this one as the pattern they follow, and the review screen re-implemented it inline for two
 * phases instead of importing it — so until now it was the canonical example that nothing ran.
 */
const draft = (): JdDraft => {
  const seed = jdDraftsFixture[0];
  if (!seed) throw new Error('jdDraftsFixture is empty');
  return {
    ...seed,
    requiredSkills: ['Design systems', 'Figma'],
    preferredSkills: ['Prototyping'],
    tools: ['Jira'],
  };
};

describe('jdSkillEdits', () => {
  it('names the list a group reads from', () => {
    const d = draft();
    expect(skillsIn(d, 'required')).toEqual(['Design systems', 'Figma']);
    expect(skillsIn(d, 'preferred')).toEqual(['Prototyping']);
    expect(skillsIn(d, 'tools')).toEqual(['Jira']);
  });

  it('appends a new skill to its own group only', () => {
    const result = addSkill(draft(), 'preferred', 'User research');
    expect(result).toEqual({ patch: { preferredSkills: ['Prototyping', 'User research'] } });
  });

  it('refuses a duplicate in the same group, case-insensitively, and says so', () => {
    expect(addSkill(draft(), 'required', 'figma')).toEqual({ refused: 'Already in this list.' });
  });

  /**
   * Required and preferred are the same question asked twice: the same skill in both would undo
   * the split the review screen exists to maintain, so the OTHER list is checked too and the
   * refusal points at the chip's own menu, which is what moves it across.
   */
  it('refuses a skill already in the sibling group and points at the move', () => {
    expect(addSkill(draft(), 'required', 'Prototyping')).toEqual({
      refused: 'Already a preferred skill — move it from there.',
    });
    expect(addSkill(draft(), 'preferred', 'Figma')).toEqual({
      refused: 'Already a required skill — move it from there.',
    });
    // Tools are their own world: a tool may share a name with a skill.
    expect(addSkill(draft(), 'tools', 'Figma')).toEqual({ patch: { tools: ['Jira', 'Figma'] } });
  });

  it('removes from exactly one group', () => {
    expect(removeSkill(draft(), 'required', 'Figma')).toEqual({
      requiredSkills: ['Design systems'],
    });
    expect(removeSkill(draft(), 'tools', 'Jira')).toEqual({ tools: [] });
  });

  /**
   * One patch carries both lists, so the chip leaves one group and lands in the other in the
   * same optimistic write — two patches would blink it off the page in between.
   */
  it('moves a skill across in a single patch', () => {
    expect(moveSkill(draft(), 'required', 'Figma')).toEqual({
      requiredSkills: ['Design systems'],
      preferredSkills: ['Prototyping', 'Figma'],
    });
    expect(moveSkill(draft(), 'preferred', 'Prototyping')).toEqual({
      preferredSkills: [],
      requiredSkills: ['Design systems', 'Figma', 'Prototyping'],
    });
  });
});
