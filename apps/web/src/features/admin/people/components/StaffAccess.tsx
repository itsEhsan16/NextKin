'use client';

import type { AdminStaffMember } from '@nextkin/shared/models';
import { useResetStaff } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { adminButton } from '../../ui/adminButton';
import { AdminDialog } from '../../ui/AdminDialog';
import { errorText } from '../dialogs/SuspendDialogs';

/**
 * A staff member's temporary password (toreview §171.13), from an invite or a sign-in reset. It is
 * shown here once; the member also gets it by email when mail is set up. Their first sign-in sets up
 * an authenticator and replaces it with a password of their own.
 */
export type StaffGrant = {
  email: string;
  temporaryPassword: string;
  emailed: boolean;
  why: 'invite' | 'reset';
};

export function TemporaryPasswordDialog({
  grant,
  onClose,
}: {
  grant: StaffGrant | null;
  onClose: () => void;
}) {
  return (
    <AdminDialog
      open={grant !== null}
      onOpenChange={(open) => !open && onClose()}
      icon="Key01"
      tone="success"
      title={grant?.why === 'reset' ? 'Sign-in reset' : 'Invite sent'}
      description={
        grant
          ? `${grant.emailed ? `We emailed ${grant.email} this temporary password.` : `Give ${grant.email} this temporary password yourself; no email was sent.`} It’s shown here once. At their first sign-in they set up an authenticator and choose their own password.`
          : ''
      }
    >
      <div className="flex flex-col gap-3">
        <code className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-center font-mono text-body-l tracking-[0.06em] text-text-primary">
          {grant?.temporaryPassword}
        </code>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(grant?.temporaryPassword ?? '')
              .then(() => showToast('Temporary password copied'))
          }
          className={adminButton.secondary}
        >
          <AdminIcon name="Copy01" />
          Copy password
        </button>
      </div>
    </AdminDialog>
  );
}

/** Staff & roles › Reset sign-in: a new temporary password, the authenticator removed, sessions ended. */
export function ResetSignInDialog({
  member,
  onClose,
  onReset,
}: {
  member: AdminStaffMember | null;
  onClose: () => void;
  onReset: (grant: StaffGrant) => void;
}) {
  const reset = useResetStaff();
  return (
    <AdminDialog
      open={member !== null}
      onOpenChange={(open) => !open && onClose()}
      icon="Key01"
      tone="warning"
      title={`Reset ${member?.name ?? ''}’s sign-in?`}
      description="Their password and authenticator stop working and they’re signed out everywhere. They sign in again with a temporary password and set up a new authenticator. The reset is audited."
      confirm={{
        label: 'Reset sign-in',
        busy: reset.isPending,
        onConfirm: () =>
          member &&
          reset.mutate(member.id, {
            onSuccess: (result) => onReset({ ...result, email: member.email, why: 'reset' }),
            onError: (error) => showToast(errorText(error), { tone: 'error' }),
          }),
      }}
    />
  );
}
