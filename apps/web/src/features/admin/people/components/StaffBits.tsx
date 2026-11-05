'use client';

import { useState } from 'react';

import {
  ADMIN_ROLE_PERMISSIONS,
  type AdminPermission,
  type AdminRole,
  type StaffInvite,
} from '@nextkin/shared/models';
import { useInviteStaff, useSetStaffRole } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup, TextField } from '../../ui/AdminForm';
import { adminTable } from '../../ui/AdminTable';
import { errorText } from '../dialogs/SuspendDialogs';
import { ROLE_LABEL } from '../peopleFormat';

export const ROLES: readonly AdminRole[] = ['super_admin', 'admin', 'curator', 'support'];

/** What each role is for, as the board's cards caption them (Figma 408:2148). */
export const ROLE_SUMMARY: Record<AdminRole, string> = {
  super_admin: 'Full access, assigns roles',
  admin: 'Users, content, plans, providers',
  curator: 'KB, skills, templates, prompts',
  support: 'Read-mostly',
};

/** A role's avatar tint in the staff table (Figma 408:2148). */
export const ROLE_TINT: Record<AdminRole, string> = {
  super_admin: 'bg-brand-100 text-brand-700',
  admin: 'bg-info-50 text-info-600',
  curator: 'bg-warning-50 text-warning-600',
  support: 'bg-success-50 text-success-600',
};

const ROLE_TONE: Record<AdminRole, AdminBadgeTone> = {
  super_admin: 'brand',
  admin: 'info',
  curator: 'neutral',
  support: 'neutral',
};

export function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <AdminBadge
      tone={ROLE_TONE[role]}
      {...(role === 'super_admin' ? { icon: <AdminIcon name="ShieldTick" size="xs" /> } : {})}
    >
      {ROLE_LABEL[role]}
    </AdminBadge>
  );
}

/** Each permission, in the server's order, with what it lets a role do (Figma 408:2148). */
const PERMISSIONS: { id: AdminPermission; description: string }[] = [
  { id: 'users.read', description: 'See user accounts, plans and usage, never resume content' },
  { id: 'users.manage', description: 'Suspend, reactivate, send password resets, comp plans' },
  { id: 'users.content', description: "Open a resume's content read-only, with a recorded reason" },
  { id: 'audit.read', description: 'Read the append-only audit log' },
  { id: 'content.manage', description: 'Edit the KB, skills, templates and AI prompts' },
  { id: 'plans.manage', description: 'Change plans, prices and usage limits' },
  { id: 'providers.manage', description: 'Turn job providers on or off and set quotas' },
  { id: 'providers.keys', description: 'Replace job-provider API keys (write-only)' },
  { id: 'analytics.read', description: 'See aggregate dashboards, with no PII' },
  { id: 'roles.assign', description: 'Invite staff, change roles and remove access' },
];

/**
 * Roles & permissions (Figma 408:2148): the matrix, read-only, from `ADMIN_ROLE_PERMISSIONS`. That
 * table is a hand-kept copy of the one the server enforces (`PERMISSIONS` in
 * `packages/server/src/services/admin/permissions.ts`, `toreview.md` §171.2): they agree today,
 * but nothing yet checks that they keep agreeing.
 */
export function PermissionsCard() {
  return (
    <AdminCard
      icon="ShieldTick"
      title="Roles & permissions"
      trailing={
        <AdminBadge tone="neutral" icon={<AdminIcon name="Lock01" size="xs" />}>
          Read-only here · change in role settings
        </AdminBadge>
      }
      bodyClassName="overflow-x-auto p-0"
    >
      <table className={cn(adminTable.table, 'min-w-[900px]')}>
        <thead className={adminTable.head}>
          <tr>
            <th scope="col" className={adminTable.th}>
              Permission
            </th>
            {ROLES.map((role) => (
              // 150px of content at the cell's left, so each heading centres over its ticks.
              <th
                key={role}
                scope="col"
                className={cn(adminTable.th, 'w-[166px] pl-0 text-center')}
              >
                {ROLE_LABEL[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission.id} className={adminTable.row}>
              <th scope="row" className={cn(adminTable.td, 'py-3 text-left font-normal')}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-text-primary">{permission.id}</span>
                  <span className="text-text-secondary">{permission.description}</span>
                </span>
              </th>
              {ROLES.map((role) => (
                <td key={role} className={cn(adminTable.td, 'py-3 pl-0 text-center')}>
                  {ADMIN_ROLE_PERMISSIONS[role].includes(permission.id) ? (
                    <span className="inline-flex size-6 items-center justify-center rounded-full border border-success-600/30 bg-success-50 text-success-600">
                      {/* The board's 14px icon/Check; no icon size token holds 14. */}
                      <AdminIcon name="Check" size="xs" className="size-3.5" />
                      <span className="sr-only">Allowed</span>
                    </span>
                  ) : (
                    <span className="text-body-m text-neutral-300">
                      <span aria-hidden>—</span>
                      <span className="sr-only">Not allowed</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </AdminCard>
  );
}

const roleOptions = ROLES.map((role) => ({
  id: role,
  label: ROLE_LABEL[role],
  description: ROLE_SUMMARY[role],
}));

/** Changing a staff member's role (the board draws the row's ⋮, not this dialog). */
export function RoleDialog({
  member,
  onClose,
}: {
  member: { id: string; name: string; role: AdminRole } | null;
  onClose: () => void;
}) {
  const [role, setRole] = useState<AdminRole | null>(null);
  const change = useSetStaffRole();
  const chosen = role ?? member?.role ?? null;
  const close = () => {
    setRole(null);
    onClose();
  };
  return (
    <AdminDialog
      open={member !== null}
      onOpenChange={(open) => !open && close()}
      icon="ShieldTick"
      tone="brand"
      title={member ? `Change ${member.name}'s role` : 'Change role'}
      description="They're signed out everywhere and sign in again with the new role. This is recorded in the audit log."
      confirm={{
        label: 'Change role',
        disabled: !member || chosen === member.role,
        busy: change.isPending,
        onConfirm: () =>
          member &&
          chosen &&
          change.mutate(
            { id: member.id, role: chosen },
            {
              onSuccess: () => {
                showToast(`${member.name} is now ${ROLE_LABEL[chosen]}`);
                close();
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <RadioCardGroup
        label="Role"
        required
        options={roleOptions}
        value={chosen}
        onChange={setRole}
      />
    </AdminDialog>
  );
}

/** "Invite staff" (Figma 408:2148): a name, an email and a role; MFA is set up on first sign-in. */
export function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The invite's temporary password, shown once (toreview §171.13). */
  onInvited?: (invite: StaffInvite) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole | null>(null);
  const invite = useInviteStaff();
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName('');
      setEmail('');
      setRole(null);
    }
  };
  const valid =
    name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && role !== null;
  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      icon="UserPlus01"
      tone="brand"
      title="Invite staff"
      description="They get a temporary password. Their first sign-in sets up an authenticator (TOTP) and their own password."
      confirm={{
        label: 'Send invite',
        disabled: !valid,
        busy: invite.isPending,
        onConfirm: () =>
          role &&
          invite.mutate(
            { name: name.trim(), email: email.trim(), role },
            {
              onSuccess: (invite) => {
                close(false);
                if (onInvited) onInvited(invite);
                else showToast(`Invite sent to ${email.trim()}`);
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Work email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <RadioCardGroup
          label="Role"
          required
          options={roleOptions}
          value={role}
          onChange={setRole}
        />
      </div>
    </AdminDialog>
  );
}
