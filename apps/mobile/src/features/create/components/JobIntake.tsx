import type { JdInput } from '@/data/models';

import { JdIntakeSection } from './JdIntakeSection';

/** A paste that is only a web address: read as a link, not as a description. */
export const isBareLink = (text: string): boolean => /^(https?:\/\/|www\.)\S+$/i.test(text.trim());

/** What "Analyze" reads: a lone web address is a link. */
export function jobIntakeInput(value: JdInput): JdInput {
  return value.source === 'paste' && isBareLink(value.text) ? { source: 'link', url: value.text.trim() } : value;
}

/** Whether "Analyze" has something to read. */
export function jobIntakeReady(value: JdInput | null): value is JdInput {
  if (value == null) return false;
  if (value.source === 'paste') return value.text.trim().length > 0;
  return true;
}

export type JobIntakeProps = {
  value: JdInput | null;
  onChange: (input: JdInput | null) => void;
};

/**
 * The one way a job comes in (toreview §114): paste the posting, upload it, or pick a saved job —
 * the JD intake every create flow shares, and a pasted link is read. Mount
 * `JdIntakeSheets` beside the page's `<Screen>` too, as `JdIntakeSection` asks.
 */
export function JobIntake({ value, onChange }: JobIntakeProps) {
  return <JdIntakeSection value={value} onChange={onChange} />;
}
