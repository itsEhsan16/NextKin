import { StringListEditor } from './StringListEditor';
import type { SectionFieldsProps } from './types';

/**
 * V2 §7.11 — the skills section. A duplicate is refused with a visible reason rather than
 * swallowed: §7.8 counts keywords, so a reader who types "figma" a second time has to be told
 * why nothing happened.
 */
export function SkillsEditor(props: SectionFieldsProps<string[]>) {
  return <StringListEditor {...props} noun="skill" label="Skills" />;
}
