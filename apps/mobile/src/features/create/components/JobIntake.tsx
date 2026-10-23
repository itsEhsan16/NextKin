import type { JdInput } from '@/data/models';

import { JdIntakeSection } from './JdIntakeSection';

/**
 * Links: the phone's data layer cannot read a job page yet (the HTTP JD repository still answers
 * `source: 'link'` from the mock, `JD_FALLBACKS`), so a pasted link is named for what it is and
 * the user is asked for the text rather than shown a reading we did not make (toreview §114).
 */
export const LINK_NOT_READ = 'We can’t read links yet. Open the posting and paste its text here.';

/** A paste that is only a web address. */
export const isBareLink = (text: string): boolean => /^(https?:\/\/|www\.)\S+$/i.test(text.trim());

/** Why this input cannot be read as it stands, or undefined when it can. */
export function jobIntakeProblem(value: JdInput | null): string | undefined {
  if (value?.source === 'paste' && isBareLink(value.text)) return LINK_NOT_READ;
  return undefined;
}

/** Whether "Analyze" has something to read. */
export function jobIntakeReady(value: JdInput | null): value is JdInput {
  if (value == null || value.source === 'link') return false;
  if (value.source === 'paste') return value.text.trim().length > 0 && !isBareLink(value.text);
  return true;
}

export type JobIntakeProps = {
  value: JdInput | null;
  onChange: (input: JdInput | null) => void;
};

/**
 * The one way a job comes in (toreview §114): paste the posting, upload it, or pick a saved job —
 * the JD intake every create flow shares, with a pasted link answered honestly. Mount
 * `JdIntakeSheets` beside the page's `<Screen>` too, as `JdIntakeSection` asks.
 */
export function JobIntake({ value, onChange }: JobIntakeProps) {
  return <JdIntakeSection value={value} onChange={onChange} pasteError={jobIntakeProblem(value)} />;
}
