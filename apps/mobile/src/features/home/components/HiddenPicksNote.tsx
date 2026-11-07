import { hiddenPicksLine, type HiddenPicks } from '@/data/models';
import { a11yButton } from '@/lib';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';

export type HiddenPicksNoteProps = { hidden: HiddenPicks; onPress: () => void };

/**
 * Says what the picks left out and why (owner, 2026-11-01, toreview §147.3). Only recommendations
 * hide anything: the Jobs tab it opens still shows every job, labelled.
 */
export function HiddenPicksNote({ hidden, onPress }: HiddenPicksNoteProps) {
  const line = hiddenPicksLine(hidden);
  return (
    <Pressable {...a11yButton(line, 'Opens all jobs')} feedback="subtle" onPress={onPress}>
      <NoteBar icon="InfoCircle" text={line} />
    </Pressable>
  );
}
