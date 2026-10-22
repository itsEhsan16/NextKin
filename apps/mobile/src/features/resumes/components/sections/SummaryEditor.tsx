import { SectionCard } from '@/features/profile/components/cards';
import { NoteBar } from '@/ui/NoteBar';
import { TextField } from '@/ui/TextField';

import { RESUME_SECTION_ART, SECTION_ART_WIDTH } from '../../editorArt';
import { SUMMARY_MAX } from '../../sectionEdits';
import type { SectionFieldsProps } from './types';

/**
 * V2 §7.11 — the professional summary, drawn as RESUMES 08 (577:8836): one card with the
 * section's icon and a line on what belongs here, the field and its count, and §7.8's own summary
 * rule as the AI note rather than a house style note.
 */
export function SummaryEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<string>) {
  return (
    <SectionCard
      art={RESUME_SECTION_ART.summary}
      artWidth={SECTION_ART_WIDTH}
      title="Summary"
      subtitle="Two or three lines: what you do, and what it changed."
    >
      <TextField
        accessibilityLabel="Professional summary"
        placeholder="What you do, and what it changed."
        value={value}
        onChangeText={onChange}
        onBlur={() => onBlurField?.('summary')}
        multiline
        minLines={5}
        maxLength={SUMMARY_MAX}
        showCount
        error={errors.summary}
      />
      <NoteBar text="Under 60 words scores best." />
    </SectionCard>
  );
}
