import { Toast } from '@/ui/Toast';

import { useProfileStore } from './profileStore';

/**
 * The Profile tab's transient confirmations. Separate from `ProfileSheetsHost` because that host
 * returns null whenever no sheet has ever been opened, and a toast has to be able to appear on its
 * own — "Rate NextKin" raises one without raising a sheet.
 *
 * Mounted beside the sheets host in the tabs layout, so it paints above the tab chrome. Nothing
 * pushed above the tabs uses it: a pushed screen would cover it, and each of those owns its own.
 */
export function ProfileToastHost() {
  const toast = useProfileStore((state) => state.toast);
  const hideToast = useProfileStore((state) => state.hideToast);

  return <Toast visible={toast != null} message={toast ?? ''} onHide={hideToast} />;
}
