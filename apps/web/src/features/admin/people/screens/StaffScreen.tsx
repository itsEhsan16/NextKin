'use client';

import { useDeferredValue, useState } from 'react';

import type { AdminRole, AdminStaffMember } from '@nextkin/shared/models';
import { useAdminMe, useAdminStaff } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { AdminPage } from '../../ui/AdminPage';
import { adminTable, TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { StatCard } from '../../ui/StatCard';
import { Notice } from '../components/Notice';
import { PersonAvatar } from '../components/PeopleBits';
import { RowMenu } from '../components/RowMenu';
import {
  ResetSignInDialog,
  TemporaryPasswordDialog,
  type StaffGrant,
} from '../components/StaffAccess';
import { copyWithToast } from '../components/StatsCaption';
import {
  InviteDialog,
  PermissionsCard,
  ROLE_SUMMARY,
  ROLE_TINT,
  RoleBadge,
  RoleDialog,
  ROLES,
} from '../components/StaffBits';
import { formatAgo, ROLE_LABEL } from '../peopleFormat';

const ROLE_ICON: Record<AdminRole, AdminIconName> = {
  super_admin: 'ShieldTick',
  admin: 'Users01',
  curator: 'BookOpen01',
  support: 'HelpCircle',
};

type Filter = AdminRole | 'all';

/**
 * Staff & roles (Figma 408:2050): how many staff hold each role, everyone with portal access, and
 * the permission matrix the server enforces. Only a Super Admin (`roles.assign`) can invite staff
 * or change a role, and nobody can change their own.
 */
export function StaffScreen() {
  const staff = useAdminStaff();
  const me = useAdminMe();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search).trim().toLowerCase();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<AdminStaffMember | null>(null);
  const [resetting, setResetting] = useState<AdminStaffMember | null>(null);
  const [grant, setGrant] = useState<StaffGrant | null>(null);
  const assign = me.data?.permissions.includes('roles.assign') ?? false;

  const members = staff.data ?? [];
  const count = (role: AdminRole) => members.filter((member) => member.role === role).length;
  const enrolled = members.filter((member) => member.mfa === 'totp').length;
  const rows = members
    .filter((member) => filter === 'all' || member.role === filter)
    .filter((member) => !q || `${member.name} ${member.email}`.toLowerCase().includes(q));
  const value = (text: string) => (staff.isPending ? undefined : staff.data ? text : '—');

  return (
    <AdminPage
      title="Staff & roles"
      subtitle="Who can do what in the admin portal. Role changes need a Super Admin and are audited."
      actions={assign && <InviteButton onClick={() => setInviting(true)} />}
    >
      <div className="grid grid-cols-2 gap-4 @min-[1000px]/admin:grid-cols-5">
        {ROLES.map((role) => (
          <StatCard
            key={role}
            icon={ROLE_ICON[role]}
            title={ROLE_LABEL[role]}
            value={value(String(count(role)))}
            caption={ROLE_SUMMARY[role]}
          />
        ))}
        <StatCard
          icon="Lock01"
          title="MFA enrolled"
          value={value(`${enrolled} of ${members.length}`)}
          badge={members.length > 0 && <MfaShare enrolled={enrolled} of={members.length} />}
          caption="TOTP is required for staff"
        />
      </div>

      <AdminCard
        icon="Users02"
        title="Staff"
        trailing={staff.data && <AdminBadge tone="neutral">{members.length}</AdminBadge>}
        bodyClassName="p-0"
      >
        <TableToolbar>
          <ButtonGroup
            label="Role"
            size="md"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All' },
              ...ROLES.map((role) => ({ id: role, label: ROLE_LABEL[role] })),
            ]}
          />
          <span className="flex-1" />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Name or email"
            className="w-[280px]"
          />
        </TableToolbar>
        {staff.isPending ? (
          <div aria-hidden className="flex flex-col gap-3 p-6">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : staff.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load staff"
            actionLabel="Try again"
            onAction={() => void staff.refetch()}
          />
        ) : staff.data === null ? (
          <NotConnected what="the staff list" />
        ) : rows.length === 0 ? (
          <CardEmpty
            title={members.length ? 'No staff match' : 'No staff yet'}
            message={
              members.length
                ? 'Try another name, email or role.'
                : 'Invite someone to give them portal access.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(adminTable.table, 'min-w-[960px]')}>
              <thead className={adminTable.head}>
                <tr>
                  <th scope="col" className={adminTable.th}>
                    Staff member
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[176px]')}>
                    Role
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[176px]')}>
                    MFA
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[176px]')}>
                    Last active
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[156px]')}>
                    Status
                  </th>
                  {/* The board's 20px ⋮ inside 16px of padding each side. */}
                  <th scope="col" className={cn(adminTable.th, 'w-13')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <tr key={member.id} className={adminTable.row}>
                    <td className={adminTable.td}>
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={member.name} tint={ROLE_TINT[member.role]} />
                        <div className="flex min-w-0 flex-col">
                          <span className={adminTable.primary}>{member.name}</span>
                          <span className={adminTable.secondary}>{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className={adminTable.td}>
                      <RoleBadge role={member.role} />
                    </td>
                    <td className={adminTable.td}>
                      {member.mfa === 'totp' ? (
                        <AdminBadge tone="success" icon={<AdminIcon name="Check" size="xs" />}>
                          TOTP on
                        </AdminBadge>
                      ) : (
                        <AdminBadge tone="warning" dot>
                          Not set up
                        </AdminBadge>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      {member.lastActiveAt ? formatAgo(member.lastActiveAt, 'date') : 'Never'}
                    </td>
                    <td className={adminTable.td}>
                      {member.status === 'active' ? (
                        <AdminBadge tone="success" dot>
                          Active
                        </AdminBadge>
                      ) : (
                        <AdminBadge tone="warning" dot>
                          Invited
                        </AdminBadge>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      <RowMenu
                        label={member.name}
                        actions={[
                          {
                            label: 'Change role…',
                            disabled: !assign || member.email === me.data?.email,
                            onSelect: () => setEditing(member),
                          },
                          {
                            label: 'Reset sign-in…',
                            disabled: !assign || member.email === me.data?.email,
                            onSelect: () => setResetting(member),
                          },
                          {
                            label: 'Copy email',
                            onSelect: () => copyWithToast(member.email, 'Email copied'),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <PermissionsCard />

      <Notice tone="brand" icon="ShieldTick" title="Role changes are protected">
        Only a Super Admin can change a role or reset a sign-in, and every change is written to the
        audit log. A new member&apos;s first sign-in sets up an authenticator (TOTP) and replaces
        their temporary password; no account opens the portal without both.
      </Notice>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        onInvited={(invite) =>
          setGrant({
            email: invite.member.email,
            temporaryPassword: invite.temporaryPassword,
            emailed: invite.emailed,
            why: 'invite',
          })
        }
      />
      <ResetSignInDialog
        member={resetting}
        onClose={() => setResetting(null)}
        onReset={(next) => {
          setResetting(null);
          setGrant(next);
        }}
      />
      <TemporaryPasswordDialog grant={grant} onClose={() => setGrant(null)} />
      <RoleDialog member={editing} onClose={() => setEditing(null)} />
    </AdminPage>
  );
}

function InviteButton({ onClick }: { onClick: () => void }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button type="button" onClick={onClick} {...hoverProps} className={adminButton.primary}>
      <AdminIcon ref={iconRef} name="UserPlus01" />
      Invite staff
    </button>
  );
}

/**
 * The MFA card's share (408:2148). The board draws the all-enrolled state, a green ↑ 100%; below
 * that it is a share, not a change, so it carries no arrow and reads amber.
 */
function MfaShare({ enrolled, of }: { enrolled: number; of: number }) {
  const share = `${Math.round((enrolled / of) * 100)}%`;
  return enrolled === of ? (
    <TrendBadge up>{share}</TrendBadge>
  ) : (
    <AdminBadge tone="warning">{share} enrolled</AdminBadge>
  );
}
