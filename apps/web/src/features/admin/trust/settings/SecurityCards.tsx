'use client';

import { useId, useState, type ReactNode } from 'react';

import {
  SESSION_TIMEOUT_OPTIONS,
  type AdminSettings,
  type AdminSettingsPatch,
} from '@nextkin/shared/models';
import { useRegenerateBackupCodes } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Switch } from '@/ui/Switch';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { AdminDialog } from '../../ui/AdminDialog';
import { BackupCodeList } from '../../ui/AuthenticatorSetup';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { SelectInput } from '../SelectInput';
import { formatShortDay } from '../trustFormat';
import { ReplaceAuthenticatorDialog } from './ReplaceAuthenticator';

/** A setting's row (Figma 409:1687): what it is and does on the left, its control on the right. */
export function SettingRow({
  title,
  description,
  lead,
  children,
  rule = true,
  id,
}: {
  title: string;
  description: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  rule?: boolean;
  id?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4', rule && 'border-b border-neutral-100 pb-4')}>
      {lead}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
        <p className="font-semibold text-text-primary">{title}</p>
        <p id={id} className="text-text-secondary">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Multi-factor authentication (Figma 409:1675): required for all staff, the authenticator, backup codes. */
export function MfaCard({ settings }: { settings: AdminSettings }) {
  const requireId = useId();
  const [confirming, setConfirming] = useState<'replace' | 'regenerate' | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  const regenerate = useRegenerateBackupCodes();
  const authenticator = settings.authenticator;
  const usedToday =
    authenticator !== null &&
    new Date(authenticator.lastUsedAt).toDateString() === new Date().toDateString();

  return (
    <AdminCard
      icon="ShieldTick"
      title="Multi-factor authentication"
      trailing={<AdminBadge tone="neutral">TOTP</AdminBadge>}
      bodyClassName="gap-4"
    >
      <SettingRow
        id={requireId}
        title="Require MFA for all staff"
        description="Every staff sign-in needs a code from an authenticator app. This can’t be turned off."
      >
        <AdminBadge tone="neutral" icon={<AdminIcon name="Lock01" size="xs" />}>
          Required for all staff
        </AdminBadge>
        <Switch
          checked
          label="Require MFA for all staff"
          describedBy={requireId}
          disabled
          onChange={() => {}}
        />
      </SettingRow>

      <SettingRow
        lead={<FeaturedIcon name="ShieldTick" tone="success" />}
        title="Your authenticator"
        description={
          authenticator
            ? `Added ${formatShortDay(authenticator.addedAt)} · last used ${
                usedToday ? 'today' : formatShortDay(authenticator.lastUsedAt)
              } at ${time(authenticator.lastUsedAt)}`
            : 'Not set up on this account yet.'
        }
      >
        <AdminBadge tone={authenticator ? 'success' : 'warning'} dot>
          {authenticator ? 'Active' : 'Not set up'}
        </AdminBadge>
        <button
          type="button"
          onClick={() => setConfirming('replace')}
          className={cn(adminButton.small, 'px-3')}
        >
          Replace
        </button>
      </SettingRow>

      <SettingRow
        rule={false}
        lead={<FeaturedIcon name="Key01" tone="neutral" />}
        title="Backup codes"
        description={`${settings.backupCodes.unused} of ${settings.backupCodes.total} unused. Regenerating replaces every old code and is audited.`}
      >
        <IconButton
          icon="RefreshCw01"
          label="Regenerate backup codes"
          onClick={() => setConfirming('regenerate')}
        />
      </SettingRow>

      <AdminDialog
        open={confirming === 'replace'}
        onOpenChange={(open) => !open && setConfirming(null)}
        icon="ShieldTick"
        tone="brand"
        title="Replace your authenticator?"
        description="Your current app stops working as soon as the new one is set up. The change is recorded in the audit log."
        confirm={{
          label: 'Continue',
          onConfirm: () => {
            setConfirming(null);
            setReplacing(true);
          },
        }}
      />

      {replacing && (
        <ReplaceAuthenticatorDialog
          onClose={() => setReplacing(false)}
          onReplaced={(next) => {
            setReplacing(false);
            setCodes(next);
            showToast('Authenticator replaced. Use the new app from now on.');
          }}
        />
      )}

      <AdminDialog
        open={confirming === 'regenerate'}
        onOpenChange={(open) => !open && setConfirming(null)}
        icon="Key01"
        tone="warning"
        title="Regenerate backup codes?"
        description="Every old code stops working. You’ll see the new ten once, so keep them somewhere safe."
        confirm={{
          label: 'Regenerate codes',
          busy: regenerate.isPending,
          onConfirm: () =>
            void regenerate
              .mutateAsync()
              .then((next) => {
                setConfirming(null);
                setCodes(next);
              })
              .catch(() =>
                showToast('The codes weren’t regenerated. Try again.', { tone: 'error' }),
              ),
        }}
      />

      <AdminDialog
        open={codes !== null}
        onOpenChange={(open) => !open && setCodes(null)}
        icon="Key01"
        tone="success"
        title="Your new backup codes"
        description="Each code works once. They won’t be shown again."
      >
        {codes && <BackupCodeList codes={codes} />}
      </AdminDialog>
    </AdminCard>
  );
}

/** Session (Figma 409:1719): the inactivity timeout, and re-authentication for sensitive actions. */
export function SessionCard({
  settings,
  onSave,
}: {
  settings: AdminSettings;
  onSave: (patch: AdminSettingsPatch, done: string) => void;
}) {
  const reauthId = useId();
  return (
    <AdminCard icon="Clock" title="Session" bodyClassName="gap-4">
      <div className="flex gap-4 border-b border-neutral-100 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
          <p className="font-semibold text-text-primary">Admin session timeout</p>
          <p className="text-text-secondary">Staff are signed out after this much inactivity.</p>
        </div>
        <SelectInput
          ariaLabel="Admin session timeout"
          className="w-[300px]"
          options={SESSION_TIMEOUT_OPTIONS.map((minutes) => ({
            id: String(minutes),
            label:
              minutes < 60
                ? `${minutes} minutes of inactivity`
                : `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'} of inactivity`,
          }))}
          value={String(settings.sessionTimeoutMinutes)}
          onChange={(value) =>
            onSave({ sessionTimeoutMinutes: Number(value) }, 'Session timeout saved')
          }
        />
      </div>
      <SettingRow
        rule={false}
        id={reauthId}
        title="Re-authenticate for sensitive actions"
        description="Ask for a fresh MFA code before suspending users, changing roles, replacing provider keys or opening resume content."
      >
        <Switch
          checked={settings.reauthForSensitive}
          label="Re-authenticate for sensitive actions"
          describedBy={reauthId}
          onChange={(on) =>
            onSave(
              { reauthForSensitive: on },
              on
                ? 'Sensitive actions now ask for a fresh code'
                : 'Sensitive actions no longer ask for a fresh code',
            )
          }
        />
      </SettingRow>
    </AdminCard>
  );
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: AdminIconName;
  label: string;
  onClick: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      className={cn(adminButton.small, 'px-3')}
    >
      <AdminIcon ref={iconRef} name={icon} />
      {label}
    </button>
  );
}
