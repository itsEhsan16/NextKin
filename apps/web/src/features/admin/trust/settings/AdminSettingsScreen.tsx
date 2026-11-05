'use client';

import { useState } from 'react';

import type { AdminSettingsPatch } from '@nextkin/shared/models';
import { useAdminMe, useAdminSettings, useUpdateAdminSettings } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { useAdminCrumb } from '../../shell/adminCrumb';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { AccountCard, RetentionCard } from './AccessCards';
import { NetworksCard } from './NetworksCard';
import { MfaCard, SessionCard } from './SecurityCards';
import { SETTINGS_TABS, SettingsTabs, type SettingsTab } from './SettingsTabs';

/**
 * Admin settings (Figma 409:1500): security for every staff account. Security is the board's own
 * tab: MFA, the session, allowed networks on the left; your account and data retention on the
 * right (440px). The other tabs aren't drawn, so Sessions and Data retention show their cards from
 * Security on their own and Notifications says it is coming (`toreview.md` §171). Every change
 * saves as it is made and is audited on the server.
 */
export function AdminSettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>('security');
  // The board's breadcrumb names the tab: Settings › Security (409:1500).
  useAdminCrumb(SETTINGS_TABS.find((entry) => entry.id === tab)?.label);
  const me = useAdminMe();
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();
  const data = settings.data;

  const onSave = (patch: AdminSettingsPatch, done: string) => {
    update.mutate(patch, {
      onSuccess: () => showToast(done),
      onError: (error) =>
        showToast(
          error instanceof Error && error.message ? error.message : 'That didn’t save. Try again.',
          {
            tone: 'error',
          },
        ),
    });
  };

  return (
    <AdminPage
      title="Settings"
      subtitle="Security for every staff account. Changes here are audited."
    >
      <SettingsTabs value={tab} onChange={setTab} />

      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {settings.isPending ? (
          <div
            aria-hidden
            className="grid gap-6 @min-[1200px]/admin:grid-cols-[minmax(0,1fr)_440px]"
          >
            <Skeleton className="h-[640px] rounded-lg" />
            <Skeleton className="h-[480px] rounded-lg" />
          </div>
        ) : settings.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load the settings"
            actionLabel="Try again"
            onAction={() => void settings.refetch()}
          />
        ) : tab === 'notifications' ? (
          <AdminCard icon="Bell01" title="Notifications">
            <CardEmpty
              title="Staff notifications are coming soon"
              message="Choose which queues and alerts reach you by email."
            />
          </AdminCard>
        ) : !data ? (
          <div className="grid items-start gap-6 @min-[1200px]/admin:grid-cols-[minmax(0,1fr)_440px]">
            <AdminCard icon="ShieldTick" title="Security">
              <NotConnected what="admin settings" />
            </AdminCard>
            <AccountCard me={me.data} settings={null} />
          </div>
        ) : tab === 'sessions' ? (
          <div className="max-w-[1100px]">
            <SessionCard settings={data} onSave={onSave} />
          </div>
        ) : tab === 'retention' ? (
          <div className="max-w-[640px]">
            <RetentionCard settings={data} />
          </div>
        ) : (
          <div className="grid items-start gap-6 @min-[1200px]/admin:grid-cols-[minmax(0,1fr)_440px]">
            <div className="flex min-w-0 flex-col gap-6">
              <MfaCard settings={data} />
              <SessionCard settings={data} onSave={onSave} />
              <NetworksCard settings={data} onSave={onSave} saving={update.isPending} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <AccountCard me={me.data} settings={data} />
              <RetentionCard settings={data} onDetails={() => setTab('retention')} />
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
