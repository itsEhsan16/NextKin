'use client';

import type { AdminUserDetail, AdminUserResume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { Soon } from '@/ui/Soon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { resumeFacts, resumeTitle } from '../dialogs/ResumeContentDialog';
import { formatDate, formatShortDate } from '../peopleFormat';
import { Notice } from './Notice';
import { PlanBadge, UsageBar, UserStatusBadge } from './PeopleBits';
import { Rows } from './UserSideCards';

/** The Account card (Figma 406:2525): status, email, plan, sign-in, MFA, deletion. */
export function AccountCard({ user }: { user: AdminUserDetail }) {
  const planLine = user.compedUntil
    ? `Comped until ${formatDate(user.compedUntil)}`
    : user.billing
      ? `${user.billing.period === 'monthly' ? 'Monthly' : 'Annual'} · since ${formatDate(user.billing.since)} · billing country ${user.billing.country}`
      : null;
  return (
    <AdminCard icon="Users01" title="Account" bodyClassName="px-5 py-1">
      <Rows
        labelWidth="w-[150px]"
        rows={[
          { label: 'Status', value: <UserStatusBadge status={user.status} /> },
          {
            label: 'Email',
            value: (
              <>
                {user.email}
                {user.emailVerified ? (
                  <AdminBadge tone="success" icon={<AdminIcon name="Check" size="xs" />}>
                    Verified
                  </AdminBadge>
                ) : (
                  <AdminBadge tone="neutral">Unverified</AdminBadge>
                )}
              </>
            ),
          },
          {
            label: 'Plan',
            value: (
              <>
                <PlanBadge plan={user.plan} />
                {planLine && <span className="text-text-secondary">{planLine}</span>}
              </>
            ),
          },
          { label: 'Sign-in method', value: user.signInMethod ?? <Unserved /> },
          {
            label: 'Two-factor (MFA)',
            value:
              user.mfa === null ? (
                <Unserved />
              ) : user.mfa === 'totp' ? (
                <AdminBadge tone="success" dot>
                  On
                </AdminBadge>
              ) : (
                <>
                  <AdminBadge tone="neutral" dot>
                    Off
                  </AdminBadge>
                  <span className="text-text-secondary">not enrolled</span>
                </>
              ),
          },
          {
            label: 'Deletion requested',
            value: user.deletionRequestedAt ? formatDate(user.deletionRequestedAt) : 'No',
          },
        ]}
      />
    </AdminCard>
  );
}

function Unserved() {
  return <span className="text-text-tertiary">Not connected yet</span>;
}

/** Usage this month (Figma 406:2525): one meter per quota, and when the counters reset. */
export function UsageCard({ user }: { user: AdminUserDetail }) {
  return (
    <AdminCard
      icon="Activity"
      title="Usage this month"
      trailing={
        user.usageResetsAt && (
          <AdminBadge tone="neutral" icon={<AdminIcon name="Clock" size="xs" />}>
            Resets {formatShortDate(user.usageResetsAt)}
          </AdminBadge>
        )
      }
      bodyClassName="gap-5"
    >
      {user.meters === null ? (
        <NotConnected what="usage per user" />
      ) : (
        user.meters.map((meter) => (
          <div key={meter.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-body-s font-semibold text-text-primary">{meter.label}</span>
                <span className="text-caption-m font-normal text-text-tertiary">
                  {meter.description}
                </span>
              </div>
              <span className="text-body-s font-medium text-neutral-700">
                {meter.used} of {meter.limit}
              </span>
            </div>
            <UsageBar used={meter.used} limit={meter.limit} height="md" label={meter.label} />
          </div>
        ))
      )}
    </AdminCard>
  );
}

/** Resumes (Figma 406:2525): metadata only, each opening through the reason dialog. */
export function ResumesCard({
  user,
  canOpen,
  onOpen,
}: {
  user: AdminUserDetail;
  /** The role has `users.content`; without it the buttons say why they can't be used. */
  canOpen: boolean;
  onOpen: (resume: AdminUserResume) => void;
}) {
  const count = user.resumeList?.length ?? user.resumes;
  return (
    <AdminCard
      icon="File06"
      title="Resumes"
      trailing={count != null && <AdminBadge tone="neutral">{count}</AdminBadge>}
      bodyClassName="px-5 pb-5 pt-2"
    >
      {user.resumeList === null ? (
        <NotConnected what="the resume list" />
      ) : user.resumeList.length === 0 ? (
        <CardEmpty title="No resumes yet" message="Resumes show here once this user creates one." />
      ) : (
        <ul>
          {user.resumeList.map((resume) => (
            <li
              key={resume.id}
              className="flex items-center gap-3 border-b border-neutral-100 py-3"
            >
              <FeaturedIcon name="File06" tone="brand" />
              <div className="flex min-w-0 flex-1 flex-col text-body-s">
                <span className="font-semibold text-text-primary">{resumeTitle(resume)}</span>
                <span className="truncate text-text-secondary">
                  {resumeFacts(resume)} · {resume.source} · created{' '}
                  {formatShortDate(resume.createdAt)}
                </span>
              </div>
              <ViewContentButton enabled={canOpen} onOpen={() => onOpen(resume)} />
            </li>
          ))}
        </ul>
      )}
      <Notice tone="warning" icon="Lock01" title="Content is private by default" className="mt-4">
        Only metadata is shown here. Opening a resume&apos;s content needs a recorded reason, is
        read-only, and is written to the audit log with your name.
      </Notice>
    </AdminCard>
  );
}

function ViewContentButton({ enabled, onOpen }: { enabled: boolean; onOpen: () => void }) {
  const { iconRef, hoverProps } = useIconHover();
  const button = (
    <button
      type="button"
      onClick={enabled ? onOpen : undefined}
      aria-disabled={enabled ? undefined : true}
      {...hoverProps}
      className={cn(
        adminButton.small,
        !enabled && 'aria-disabled:cursor-default aria-disabled:opacity-60',
      )}
    >
      <AdminIcon ref={iconRef} name="Lock01" />
      View content
    </button>
  );
  return enabled ? button : <Soon label="Your role can't open resume content">{button}</Soon>;
}
