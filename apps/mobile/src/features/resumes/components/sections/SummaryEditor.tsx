import { TextField } from '@/ui/TextField';

import { SUMMARY_MAX } from '../../sectionEdits';
import type { SectionFieldsProps } from './types';

/**
 * V2 §7.11 — the professional summary. One field, because that is what the section is; the
 * helper carries §7.8's own summary rule rather than a house style note.
 */
export function SummaryEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<string>) {
  return (
    <TextField
      label="Professional summary"
      accessibilityLabel="Professional summary"
      placeholder="Two or three lines: what you do, and what it changed."
      value={value}
      onChangeText={onChange}
      onBlur={() => onBlurField?.('summary')}
      multiline
      minLines={5}
      maxLength={SUMMARY_MAX}
      showCount
      helper="Under 60 words scores best."
      error={errors.summary}
    />
  );
}
