import {
  useDeleteResume,
  useDuplicateResume,
  useRenameResume,
  useSetResumeAsBase,
} from '@/data/queries';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { ResumeMenuSheetBody } from './components/ResumeMenuSheetBody';
import { useResumesActions } from './hooks/useResumesActions';
import { useShareDocument } from './hooks/useShareDocument';
import { useResumesStore, type ResumeSurface } from './resumesStore';

export type ResumeMenuHostProps = {
  /**
   * Which mount this is. The tabs layout hosts one for the library; the editor hosts its own,
   * because a pushed screen sits above the tabs layout and would cover the sheet raised there.
   * Only the mount matching the store's `menuSurface` renders.
   */
  surface?: ResumeSurface;
};

/**
 * Mounts RESUMES 03 once, above the tab bar and the FAB, so its scrim dims the chrome — the
 * artboard draws the bottom nav before the scrim (1:2008 precedes 1:2019), the same z-order as
 * the filters sheet and the reverse of the create sheet.
 *
 * Renders from the store's snapshot rather than the query cache: the menu opens off a card
 * already on screen, and the snapshot keeps painting through the exit animation even while a
 * delete removes the document underneath it.
 *
 * Rename is a step of this sheet rather than a screen of its own (V2 §7.11 — it is a title edit).
 * That step holds the sheet's one text field, so the sheet rises with the keyboard on iOS.
 */
export function ResumeMenuHost({ surface = 'tabs' }: ResumeMenuHostProps) {
  const { sizes } = useTheme();

  const open = useResumesStore((state) => state.menuOpen);
  const resume = useResumesStore((state) => state.menuResume);
  const step = useResumesStore((state) => state.menuStep);
  const menuSurface = useResumesStore((state) => state.menuSurface);
  const closeMenu = useResumesStore((state) => state.closeMenu);
  const requestRename = useResumesStore((state) => state.requestRename);
  const cancelRename = useResumesStore((state) => state.cancelRename);
  const requestDelete = useResumesStore((state) => state.requestDelete);
  const cancelDelete = useResumesStore((state) => state.cancelDelete);

  const actions = useResumesActions();
  const duplicate = useDuplicateResume();
  const setAsBase = useSetResumeAsBase();
  const rename = useRenameResume();
  const remove = useDeleteResume();
  // Hooks run before the guard below — `useShareDocument` is a mutation, so an empty id is
  // simply never fired.
  const share = useShareDocument(resume?.id ?? '', menuSurface);

  if (!resume || menuSurface !== surface) return null;

  const closeAnd = (navigate: () => void) => () => {
    closeMenu();
    navigate();
  };

  return (
    <Sheet
      open={open}
      onClose={closeMenu}
      // The confirm and rename steps are much shorter; changing the floor morphs the sheet height
      // on the UI thread, the same move as the create sheet's 600 → 555.
      height={step === 'actions' ? sizes.sheetResumeMenuHeight : sizes.sheetPickerHeight}
      // Only the rename step holds a field, so the keyboard lift mounts only for that step.
      avoidKeyboard={step === 'rename'}
      accessibilityLabel={`Actions for ${resume.title}`}
    >
      <ResumeMenuSheetBody
        resume={resume}
        step={step}
        deleting={remove.isPending}
        renaming={rename.isPending}
        onRename={requestRename}
        onSubmitRename={(title) => {
          rename.mutate({ id: resume.id, title }, { onSuccess: closeMenu });
        }}
        onCancelRename={cancelRename}
        onDuplicate={() => {
          duplicate.mutate(resume.id);
          closeMenu();
        }}
        onTailor={closeAnd(() => actions.tailorResume(resume))}
        onSetAsBase={() => {
          setAsBase.mutate(resume.id);
          closeMenu();
        }}
        onDownload={closeAnd(() => actions.downloadResume(resume, menuSurface))}
        onShare={closeAnd(share.share)}
        onRequestDelete={requestDelete}
        onConfirmDelete={() => {
          remove.mutate(resume.id, { onSettled: closeMenu });
        }}
        onCancelDelete={cancelDelete}
      />
    </Sheet>
  );
}
