'use client';

import type { ReactNode } from 'react';

import { ADMIN_ROLE_LABEL, type AdminMe, type AdminSettings } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { StaffAvatar } from '../../shell/StaffCard';
import { maskIp } from '../trustFormat';

const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Your account (Figma 409:1780): who is signed in, read-only; a Super Admin changes roles. */
export function AccountCard({
  me,
  settings,
}: {
  me: AdminMe | undefined;
  settings: AdminSettings | null;
}) {
  return (
    <AdminCard icon="Users01" title="Your account" bodyClassName="gap-4">
      {!me ? (
        <>
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-40 w-full" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="[&>span]:size-12">
              <StaffAvatar name={me.name} />
            </span>
            <div className="flex min-w-0 flex-col">
              <p className="text-body-m font-semibold text-text-primary">{me.name}</p>
              <p className="text-body-s text-text-secondary">{me.email}</p>
            </div>
          </div>
          <dl className="flex flex-col">
            <Row label="Name">{me.name}</Row>
            <Row label="Email">{me.email}</Row>
            <Row label="Role">
              <AdminBadge tone="brand" icon={<AdminIcon name="Lock01" size="xs" />}>
                {ADMIN_ROLE_LABEL[me.role]}
              </AdminBadge>
            </Row>
            <Row label="Last sign-in">
              {settings?.lastSignIn ? lastSignInText(settings.lastSignIn) : '—'}
            </Row>
          </dl>
          <p className="flex items-center gap-2 rounded-sm bg-neutral-50 px-3 py-2.5 text-body-s text-text-secondary">
            <AdminIcon name="InfoCircle" size="sm" className="text-neutral-500" />
            Your role is read-only here. Ask a Super Admin to change your role.
          </p>
        </>
      )}
    </AdminCard>
  );
}

/** Data retention (Figma 409:1821): how long each kind of record is kept. Set by policy, read-only. */
export function RetentionCard({
  settings,
  onDetails,
}: {
  settings: AdminSettings;
  onDetails?: () => void;
}) {
  return (
    <AdminCard
      icon="Archive"
      title="Data retention"
      trailing={onDetails && <DetailsLink onClick={onDetails} />}
    >
      <dl className="flex flex-col">
        {settings.retention.map((row) => (
          <Row key={row.label} label={row.label} width="w-[130px]">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-text-primary">{row.value}</span>
              <span className="flex items-center gap-1 text-caption-m font-normal text-text-tertiary">
                <AdminIcon name="Lock01" size="xs" />
                Set by policy
              </span>
            </span>
          </Row>
        ))}
      </dl>
    </AdminCard>
  );
}

function DetailsLink({ onClick }: { onClick: () => void }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      className="relative flex items-center gap-1.5 rounded-sm py-2 text-body-s font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      Details
      <AdminIcon ref={iconRef} name="ArrowRight" />
    </button>
  );
}

function Row({
  label,
  children,
  width = 'w-[110px]',
}: {
  label: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-neutral-100 py-3 last:border-b-0">
      <dt className={cn('shrink-0 text-body-s font-medium text-text-secondary', width)}>{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body-s text-text-primary">
        {children}
      </dd>
    </div>
  );
}

/** "Today 09:14 · 203.0.113.•••", or the date when it wasn't today; the IP only when it was seen. */
function lastSignInText({ at, ip }: { at: string; ip: string | null }) {
  const day =
    new Date(at).toDateString() === new Date().toDateString()
      ? 'Today'
      : new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${shortTime(at)}${ip ? ` · ${maskIp(ip)}` : ''}`;
}
