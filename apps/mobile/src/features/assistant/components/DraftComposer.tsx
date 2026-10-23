import { useAssistantDraftStore } from '../assistantDraftStore';
import { AssistantComposer, type AssistantComposerProps } from './AssistantComposer';

export type DraftComposerProps = Omit<AssistantComposerProps, 'value' | 'onChange' | 'onSend'> & {
  /** Called with the text as typed; the screen trims it and clears the draft once sent. */
  onSend: (text: string) => void;
};

/** The composer bound to the draft store, so its keystrokes stay inside this component. */
export function DraftComposer({ onSend, ...rest }: DraftComposerProps) {
  const draft = useAssistantDraftStore((state) => state.draft);
  const setDraft = useAssistantDraftStore((state) => state.setDraft);

  return (
    <AssistantComposer {...rest} value={draft} onChange={setDraft} onSend={() => onSend(draft)} />
  );
}
