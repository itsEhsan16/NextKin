import { useSubscription } from '@/data/queries';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';
import { Toast } from '@/ui/Toast';

import { ExportSheetBody } from './components/ExportSheetBody';
import { useDocumentExport } from './hooks/useDocumentExport';
import { useResumesActions } from './hooks/useResumesActions';
import { useResumesStore, type ResumeSurface } from './resumesStore';

export type ResumeExportHostProps = {
  /**
   * Which mount this is. The tabs layout hosts one; the editor hosts its own, because a pushed
   * screen sits above the tabs layout and would cover the sheet raised there. Only the mount
   * matching the store's surface renders — one paint, one BackHandler, one scrim.
   */
  surface?: ResumeSurface;
};

/**
 * V2 §7.12's download sheet, plus the confirmation toast that reports what happened to the file.
 *
 * Both are hosted rather than screen-local: the export is started from the library card menu, the
 * editor and the score panel alike, and the OS share sheet has to be handed the file from the
 * surface that asked. The toast lives here too because it is the only thing left on screen once
 * the sheet closes.
 *
 * Renders from the store's retained snapshot (`exportResume` is deliberately not cleared on
 * close), so the sheet does not empty during its 200ms exit.
 */
export function ResumeExportHost({ surface = 'tabs' }: ResumeExportHostProps) {
  const { sizes } = useTheme();

  const open = useResumesStore((state) => state.exportOpen);
  const resume = useResumesStore((state) => state.exportResume);
  const exportSurface = useResumesStore((state) => state.exportSurface);
  const closeExport = useResumesStore((state) => state.closeExport);
  const toast = useResumesStore((state) => state.toast);
  const toastSurface = useResumesStore((state) => state.toastSurface);
  const hideToast = useResumesStore((state) => state.hideToast);

  const actions = useResumesActions();
  const subscription = useSubscription();
  // While the plan is still loading — or failed to load — treat it as FREE. Unlocking a paid
  // format against a plan we have not read is the one mistake that cannot be taken back: the
  // export would reach the repo, throw PlanLockedError, and the reader would have watched a
  // control they were allowed to press fail.
  const plan = subscription.data?.plan === 'pro' ? 'pro' : 'free';

  const mine = exportSurface === surface;
  // The mount that is not showing the sheet never fires an export: an empty id disables the hook.
  const { run, busyFormat } = useDocumentExport(mine && resume ? resume.id : '', surface);

  const toastVisible = toast != null && toastSurface === surface;
  if (!resume && !toastVisible) return null;

  return (
    <>
      {resume && mine ? (
        <Sheet
          open={open}
          onClose={closeExport}
          height={sizes.sheetExportHeight}
          accessibilityLabel={`Download ${resume.title}`}
        >
          <ExportSheetBody
            resume={resume}
            plan={plan}
            busyFormat={busyFormat}
            onSelect={run}
            onUpgrade={() => {
              // §13.5: the upsell replaces the action. The sheet gets out of the way first, so
              // the comparison screen is not raised behind a scrim.
              closeExport();
              actions.openUpgrade('docx');
            }}
          />
        </Sheet>
      ) : null}

      <Toast visible={toastVisible} message={toast ?? ''} onHide={hideToast} />
    </>
  );
}
