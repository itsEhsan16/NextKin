import { create } from 'zustand';

type CreateState = {
  /** Whether the saved-job picker `JdIntakeSection` raises is up. */
  jobSheetOpen: boolean;
  openJobSheet: () => void;
  closeJobSheet: () => void;
};

/**
 * Sheet state for the create flow, beside `jobsStore`, `profileStore` and `resumesStore` — a
 * store rather than local state because a `Sheet` is an absoluteFill overlay: inside the page's
 * ScrollView it would scrim the scrolling content instead of the window and dock its panel to
 * the bottom of the content rather than the bottom of the glass.
 *
 * So the rows that raise a sheet live in the page (`JdIntakeSection`) and the sheet itself is
 * mounted beside `<Screen>` (`JdIntakeSheets`) — the split `ProfileSheetsHost` and
 * `ResumeMenuHost` already use.
 */
export const useCreateStore = create<CreateState>((set) => ({
  jobSheetOpen: false,
  openJobSheet: () => set({ jobSheetOpen: true }),
  closeJobSheet: () => set({ jobSheetOpen: false }),
}));
