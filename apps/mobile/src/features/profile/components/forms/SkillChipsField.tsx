import { SKILL_SUGGESTIONS } from '@/data/models';
import { pluralize } from '@/lib';

import { addRoleSkill, removeRoleSkill } from '../../profileForms';
import { PROFILE_ROW_ART } from '../../profileRowArt';
import { SectionCard } from '../cards';
import { ChipField, SuggestedLabel, SuggestionChips } from '../ChipListParts';

/** Enough to be useful under one field; more turns the form into a directory (573:271). */
const MAX_SUGGESTIONS = 4;

export type SkillChipsFieldProps = {
  value: string[];
  onChange: (skills: string[]) => void;
};

/**
 * The skills this role is where you used them (V2 §7.3 — `Experience.skills`; PROFILE 05 573:238):
 * the chosen chips, a field to add one, and the shipped vocabulary underneath.
 *
 * An empty list is not an error state — the add row IS the empty state.
 */
export function SkillChipsField({ value, onChange }: SkillChipsFieldProps) {
  const suggestions = SKILL_SUGGESTIONS.filter(
    (skill) => !value.some((chosen) => chosen.toLowerCase() === skill.toLowerCase()),
  ).slice(0, MAX_SUGGESTIONS);

  const add = (skill: string): string | undefined => {
    const result = addRoleSkill(value, skill);
    if ('refused' in result) return result.refused;
    onChange(result.skills);
    return undefined;
  };

  return (
    <SectionCard
      art={PROFILE_ROW_ART.skills}
      artWidth={28}
      title="Skills used in this role"
      trailing={value.length > 0 ? pluralize(value.length, 'skill') : undefined}
    >
      <ChipField
        noun="skill"
        items={value}
        placeholder="Add a skill"
        addLabel="Add a skill"
        onAdd={add}
        onRemove={(skill) => onChange(removeRoleSkill(value, skill))}
      />
      {suggestions.length > 0 ? (
        <>
          <SuggestedLabel />
          <SuggestionChips noun="skill" items={suggestions} onAdd={(skill) => void add(skill)} />
        </>
      ) : null}
    </SectionCard>
  );
}
