import type { SectionDraft } from '../../sectionEdits';
import { CertificationsEditor } from './CertificationsEditor';
import { EducationEditor } from './EducationEditor';
import { ExperienceEditor } from './ExperienceEditor';
import { LetterEditor } from './LetterEditor';
import { ProjectsEditor } from './ProjectsEditor';
import { SkillsEditor } from './SkillsEditor';
import { SummaryEditor } from './SummaryEditor';

export type SectionBodyProps = {
  draft: SectionDraft;
  onChange: (next: SectionDraft) => void;
  errors: Record<string, string>;
  onBlurField?: (key: string) => void;
};

/**
 * Picks the body for the section on screen (V2 §7.11; §7.10 for the letter). The switch is what
 * keeps the draft's value correlated to its section — each branch narrows, so no editor can be
 * handed a value of the wrong shape and the write that follows is typed all the way to the repo.
 */
export function SectionBody({ draft, onChange, errors, onBlurField }: SectionBodyProps) {
  const rest = { errors, onBlurField };
  switch (draft.section) {
    case 'summary':
      return (
        <SummaryEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'summary', value })}
          {...rest}
        />
      );
    case 'skills':
      return (
        <SkillsEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'skills', value })}
          {...rest}
        />
      );
    case 'certifications':
      return (
        <CertificationsEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'certifications', value })}
          {...rest}
        />
      );
    case 'experience':
      return (
        <ExperienceEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'experience', value })}
          {...rest}
        />
      );
    case 'projects':
      return (
        <ProjectsEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'projects', value })}
          {...rest}
        />
      );
    case 'education':
      return (
        <EducationEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'education', value })}
          {...rest}
        />
      );
    case 'letter':
      return (
        <LetterEditor
          value={draft.value}
          onChange={(value) => onChange({ section: 'letter', value })}
          {...rest}
        />
      );
  }
}
