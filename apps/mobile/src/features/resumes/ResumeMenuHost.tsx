import { useDeleteResume, useDuplicateResume, useSetResumeAsBase } from '@/data/queries';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { ResumeMenuSheetBody } from './components/ResumeMenuSheetBody';
import { useResumesActions } from './hooks/useResumesActions';
import { useResumesStore } from './resumesStore';

/**
 * Mounts RESUMES 03 once, above the tab bar and the FAB, so its scrim dims the chrome — the
 * artboard draws the bottom nav before the scrim (1:2008 precedes 1:2019), the same z-order as
 * the filters sheet and the reverse of the create sheet.
 *
 * Renders from the store's snapshot rather than the query cache: the menu opens off a card
 * already on screen, and the snapshot keeps painting through the exit animation even while a
 * delete removes the document underneath it.
 */
export function ResumeMenuHost() {
  const { sizes } = useTheme();

  const open = useResumesStore((state) => state.menuOpen);
  const resume = useResumesStore((state) => state.menuResume);
  const step = useResumesStore((state) => state.menuStep);
  const closeMenu = useResumesStore((state) => state.closeMenu);
  const requestDelete = useResumesStore((state) => state.requestDelete);
  const cancelDelete = useResumesStore((state) => state.cancelDelete);

  const actions = useResumesActions();
  const duplicate = useDuplicateResume();
  const setAsBase = useSetResumeAsBase();
  const remove = useDeleteResume();

  if (!resume) return null;

  const closeAnd = (navigate: () => void) => () => {
    closeMenu();
    navigate();
  };

  return (
    <Sheet
      open={open}
      onClose={closeMenu}
      // The confirm step is much shorter; changing the floor morphs the sheet height on the
      // UI thread, the same move as the create sheet's 600 → 520.
      height={step === 'confirm-delete' ? sizes.sheetPickerHeight : sizes.sheetResumeMenuHeight}
      accessibilityLabel={`Actions for ${resume.title}`}
    >
      <ResumeMenuSheetBody
        resume={resume}
        step={step}
        deleting={remove.isPending}
        onRename={closeAnd(actions.renameResume)}
        onDuplicate={() => {
          duplicate.mutate(resume.id);
          closeMenu();
        }}
        onTailor={closeAnd(actions.tailorResume)}
        onSetAsBase={() => {
          setAsBase.mutate(resume.id);
          closeMenu();
        }}
        onDownload={closeAnd(actions.downloadResume)}
        onShare={closeAnd(actions.shareResume)}
        onRequestDelete={requestDelete}
        onConfirmDelete={() => {
          remove.mutate(resume.id, { onSettled: closeMenu });
        }}
        onCancelDelete={cancelDelete}
      />
    </Sheet>
  );
}
