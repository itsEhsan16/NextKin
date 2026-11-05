import { ADMIN_ROLE_LABEL, type AdminRole, type AuditEvent } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { initialsOf } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { adminTable } from '../../ui/AdminTable';
import { maskIp, utcParts } from '../trustFormat';

/** Each role's avatar tint in the audit log (Figma 408:1765: Priya green, Ehsan indigo, …). */
const ROLE_TINT: Record<AdminRole, string> = {
  support: 'bg-success-50 text-success-600',
  super_admin: 'bg-brand-100 text-brand-700',
  curator: 'bg-warning-50 text-warning-600',
  admin: 'bg-info-50 text-info-600',
};

const th = cn(adminTable.th, 'px-2 first:pl-6 last:pr-4');
const td = cn(adminTable.td, 'px-2 first:pl-6 last:pr-4');

/**
 * The append-only log (Figma 408:1745): when (UTC), who, what, to which masked target, why, and
 * from which address (masked). No row menu: nothing here can be edited or deleted.
 */
export function AuditTable({ rows }: { rows: AuditEvent[] }) {
  return (
    <table className={cn(adminTable.table, 'min-w-[1180px]')}>
      <thead className={adminTable.head}>
        <tr>
          <th scope="col" className={cn(th, 'w-[172px]')}>
            Time (UTC)
          </th>
          <th scope="col" className={cn(th, 'w-[206px]')}>
            Staff
          </th>
          <th scope="col" className={cn(th, 'w-[296px]')}>
            Action
          </th>
          <th scope="col" className={cn(th, 'w-[206px]')}>
            Target
          </th>
          <th scope="col" className={th}>
            Reason
          </th>
          <th scope="col" className={cn(th, 'w-[174px]')}>
            IP address
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const when = utcParts(row.at);
          return (
            <tr key={row.id} className={adminTable.row}>
              <td className={td}>
                <time dateTime={row.at} className="flex flex-col">
                  <span className="font-medium text-text-primary">{when.date}</span>
                  <span>{when.time}</span>
                </time>
              </td>
              <td className={td}>
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-900/10 text-caption-m font-semibold',
                      ROLE_TINT[row.staff.role],
                    )}
                  >
                    {initialsOf(row.staff.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={adminTable.primary}>{row.staff.name}</span>
                    <span className={adminTable.secondary}>{ADMIN_ROLE_LABEL[row.staff.role]}</span>
                  </span>
                </span>
              </td>
              <td className={td}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary">{row.action}</span>
                  {row.contentRead && (
                    <AdminBadge tone="warning" icon={<AdminIcon name="Eye" size="xs" />}>
                      Audited read
                    </AdminBadge>
                  )}
                </span>
              </td>
              <td className={td}>
                <AdminBadge tone="neutral">{row.target.label}</AdminBadge>
              </td>
              {/* The board's missing reason is a pale dash (408:2001); a cut-off reason reads whole
                  on hover. */}
              <td
                title={row.reason === '—' ? undefined : row.reason}
                className={cn(td, 'truncate', row.reason === '—' && 'text-neutral-400')}
              >
                {row.reason}
              </td>
              <td className={td}>{maskIp(row.ip)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
