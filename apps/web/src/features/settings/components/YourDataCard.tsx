'use client';

import { useDataExport, useRequestDataExport } from '@nextkin/shared/queries';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { exportLine } from '@/lib/dataExport';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { dangerOutlineButton } from '@/ui/dangerOutlineButton';
import {
  NavDocumentsIllustration,
  SettingsDeleteIllustration,
  SettingsExportIllustration,
  SettingsPreferencesIllustration,
} from '@/ui/illustrations';

import { RowChevron, SETTING_LIST, SettingRow } from './SettingRow';
import { Soon, soonControl } from '@/ui/Soon';

const ACTION = 'h-control-sm min-w-32 shrink-0 rounded-sm px-3 text-body-s font-semibold';

/** The download row's own line until an archive has been asked for (the mockup's). */
const EXPORT_IDLE = 'Get a copy of your profile, resumes, and activity data.';

/**
 * "Your data" (Privacy & data mockup). Download runs the data export (V2 §8.5), and the row's line says where it has got to. While the archive builds, the
 * button stays focusable but does nothing (`aria-disabled`), so a keyboard user keeps their place.
 * "Manage data preferences" has nowhere to go yet. "Delete my data" would be V2's account deletion,
 * which Settings → Delete account carries; its drawn line promises more than that deletion does
 * and never says the account goes, so it wants new words before it does anything. Both say
 * "Coming soon" (`toreview.md` §30, §102).
 */
export function YourDataCard() {
  const dataExport = useDataExport();
  const requestExport = useRequestDataExport();
  const status = dataExport.data?.status;
  const preparing = status === 'preparing' || requestExport.isPending;

  return (
    <AccountCard
      Art={NavDocumentsIllustration}
      title="Your data"
      description="Access, download, or manage your data."
    >
      <ul className={SETTING_LIST}>
        <SettingRow
          Icon={SettingsExportIllustration}
          title="Download your data"
          line={<span role="status">{exportLine(dataExport.data, EXPORT_IDLE)}</span>}
          control={(lineId) => (
            <button
              type="button"
              aria-describedby={lineId}
              aria-disabled={preparing}
              onClick={() => {
                if (!preparing) requestExport.mutate();
              }}
              className={cn(
                brandOutlineButton,
                ACTION,
                'aria-disabled:cursor-default aria-disabled:opacity-60',
              )}
            >
              {status === 'ready' ? 'Prepare a new copy' : 'Download data'}
            </button>
          )}
        />
        <SettingRow
          Icon={SettingsPreferencesIllustration}
          title="Manage data preferences"
          line="Control how your data is collected and used."
          control={(lineId) => <RowChevron label="Manage data preferences" describedBy={lineId} />}
        />
        <SettingRow
          Icon={SettingsDeleteIllustration}
          title="Delete my data"
          line="Permanently delete all your data from our systems."
          control={(lineId) => (
            <Soon>
              <button
                aria-disabled="true"
                type="button"
                aria-describedby={lineId}
                className={cn(soonControl, dangerOutlineButton, ACTION)}
              >
                Delete my data
              </button>
            </Soon>
          )}
        />
      </ul>
    </AccountCard>
  );
}
