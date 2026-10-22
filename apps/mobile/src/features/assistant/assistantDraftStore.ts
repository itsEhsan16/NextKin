import { create } from 'zustand';

type AssistantDraftState = {
  draft: string;
  setDraft: (draft: string) => void;
};

/**
 * The composer's unsent text, outside the screen's state.
 *
 * Held in the screen, every keystroke re-rendered the whole transcript. Here the composer
 * subscribes to the text and the screen only to whether it is empty (which shows or hides the
 * suggested prompts), so typing re-renders the composer alone. The screen clears it on unmount.
 */
export const useAssistantDraftStore = create<AssistantDraftState>((set) => ({
  draft: '',
  setDraft: (draft) => set({ draft }),
}));
