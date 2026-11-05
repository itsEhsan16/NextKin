'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AdminUserAction, AdminUserActionKind, AdminUserDetail } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';
import { textLink } from '@/ui/textLink';

import { formatMoney } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { FeaturedIcon, type FeaturedTone } from '../../ui/FeaturedIcon';
import { formatDate, formatDateTime, formatShortDate } from '../peopleFormat';
import { PlanBadge } from './PeopleBits';

export const COMP_MONTHS = [1, 3, 6, 12] as const;

/** Label-value rows with a slate rule between them; the label 120px (Plan & access) or 150 (Account). */
export function Rows({
  rows,
  labelWidth = 'w-[120px]',
}: {
  rows: { label: string; value: ReactNode }[];
  labelWidth?: string;
}) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex min-h-[45px] items-center gap-4 border-b border-neutral-100 py-3 last:border-b-0"
        >
          <dt className={cn(labelWidth, 'shrink-0 text-body-s font-medium text-text-secondary')}>
            {row.label}
          </dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body-s text-text-primary">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Plan & access (Figma 406:2526): the plan and price, renewal, Stripe, and comping Pro. */
export function PlanAccessCard({
  user,
  canManage,
  onComp,
}: {
  user: AdminUserDetail;
  canManage: boolean;
  onComp: (months: number) => void;
}) {
  const billing = user.billing;
  return (
    <AdminCard icon="CreditCard02" title="Plan & access" bodyClassName="px-5 pb-5 pt-1">
      <Rows
        rows={[
          {
            label: 'Plan',
            value: (
              <>
                <PlanBadge plan={user.plan} />
                {billing && (
                  <span className="text-text-secondary">
                    {formatMoney(billing.priceMinor, billing.currency)} /{' '}
                    {billing.period === 'monthly' ? 'month' : 'year'}
                  </span>
                )}
              </>
            ),
          },
          {
            label: user.compedUntil ? 'Comped until' : 'Renews',
            value: user.compedUntil
              ? formatDate(user.compedUntil)
              : billing?.renewsAt
                ? formatDate(billing.renewsAt)
                : '—',
          },
          {
            label: 'Stripe customer',
            value: billing ? (
              <AdminBadge tone="neutral">{`cus ···${billing.stripeCustomer.slice(-4)}`}</AdminBadge>
            ) : (
              '—'
            ),
          },
        ]}
      />
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-4">
          {canManage && (
            <FilterDropdown
              align="start"
              trigger={
                <button type="button" className={cn(adminButton.secondary, menuTrigger)}>
                  <AdminIcon name="CoinsStacked01" />
                  Comp Pro…
                  <AdminIcon
                    name="ChevronDown"
                    size="sm"
                    className={cn('text-neutral-500', chevronTurn)}
                  />
                </button>
              }
            >
              {COMP_MONTHS.map((months) => (
                <MenuItem key={months} onSelect={() => onComp(months)}>
                  {months} month{months === 1 ? '' : 's'}
                </MenuItem>
              ))}
            </FilterDropdown>
          )}
          {billing && <StripeLink customer={billing.stripeCustomer} />}
        </div>
        <p className="text-body-s text-text-secondary">
          Comp Pro grants 1–12 months free. Refunds and disputes are handled in Stripe.
        </p>
      </div>
    </AdminCard>
  );
}

function StripeLink({ customer }: { customer: string }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <a
      href={`https://dashboard.stripe.com/customers/${customer}`}
      target="_blank"
      rel="noreferrer"
      {...hoverProps}
      className={cn(
        textLink,
        'inline-flex items-center gap-1 text-body-m font-semibold text-brand-700',
      )}
    >
      Open in Stripe
      <AdminIcon ref={iconRef} name="ArrowUpRight" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Danger zone (Figma 406:2526): deleting the account, on a red tray. */
export function DangerZoneCard({
  user,
  canManage,
  onDelete,
}: {
  user: AdminUserDetail;
  canManage: boolean;
  onDelete: () => void;
}) {
  const first = user.name.split(' ')[0];
  const { iconRef, hoverProps } = useIconHover();
  return (
    <AdminCard
      icon="AlertTriangle"
      title="Danger zone"
      className="border-danger-600/30 bg-danger-50"
      bodyClassName="gap-4"
    >
      <div className="flex flex-col gap-1 text-body-s">
        <p className="font-semibold text-text-primary">Delete account</p>
        <p className="text-text-secondary">
          {user.deletionRequestedAt
            ? `Deletion was requested on ${formatDate(user.deletionRequestedAt)}. Every row ${first} owns is purged within 30 days of that.`
            : `Signs ${first} out everywhere right away, then purges every row they own within 30 days. This can't be undone and is recorded in the audit log.`}
        </p>
      </div>
      {canManage && !user.deletionRequestedAt && (
        <button
          type="button"
          onClick={onDelete}
          {...hoverProps}
          className={cn(adminButton.danger, 'w-fit')}
        >
          <AdminIcon ref={iconRef} name="Trash01" />
          Delete account
        </button>
      )}
    </AdminCard>
  );
}

const ACTION: Record<AdminUserActionKind, { icon: AdminIconName; tone: FeaturedTone }> = {
  password_reset: { icon: 'Key01', tone: 'brand' },
  content_read: { icon: 'Eye', tone: 'warning' },
  usage_reset: { icon: 'RefreshCw01', tone: 'success' },
  email_changed: { icon: 'Mail01', tone: 'info' },
  suspended: { icon: 'UserX01', tone: 'danger' },
  reactivated: { icon: 'UserPlus01', tone: 'success' },
  comped: { icon: 'CoinsStacked01', tone: 'brand' },
  deletion_requested: { icon: 'Trash01', tone: 'danger' },
};

/** The last week's actions carry their time, as the board's "Nov 3, 18:01"; older ones the date. */
const actionWhen = (iso: string, now = Date.now()) =>
  now - Date.parse(iso) < 7 * 86_400_000 ? formatDateTime(iso) : formatShortDate(iso);

/** Recent admin actions (Figma 406:2526): what staff did to this account, newest first. */
export function AdminActionsCard({
  actions,
  limit,
}: {
  actions: AdminUserAction[] | null;
  limit?: number;
}) {
  const shown = actions && limit ? actions.slice(0, limit) : actions;
  return (
    <AdminCard icon="ClipboardCheck" title="Recent admin actions" bodyClassName="gap-4">
      {shown === null ? (
        <NotConnected what="actions per user" />
      ) : shown.length === 0 ? (
        <CardEmpty
          title="No admin actions"
          message="Anything staff do to this account shows here."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((action) => (
            <li key={action.id} className="flex animate-rise items-center gap-3">
              <FeaturedIcon name={ACTION[action.kind].icon} tone={ACTION[action.kind].tone} />
              <div className="flex min-w-0 flex-col text-body-s">
                <span className="font-semibold text-text-primary">{action.label}</span>
                <span className="truncate text-text-secondary">
                  {[action.by, action.note, actionWhen(action.at)].filter(Boolean).join(' · ')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-neutral-100 pt-4">
        <AuditLink />
      </div>
    </AdminCard>
  );
}

function AuditLink() {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <Link
      href={'/admin/audit' as Route}
      {...hoverProps}
      className="inline-flex h-9 items-center gap-1.5 rounded-sm text-body-s font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      Open in audit log
      <AdminIcon ref={iconRef} name="ArrowRight" />
    </Link>
  );
}
