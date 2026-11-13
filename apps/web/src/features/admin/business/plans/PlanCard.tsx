'use client';

import type { AdminPlan, PlanQuota } from '@nextkin/shared/models';

import { AdminIcon } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';

import { formatCount, formatRate } from '../../format';
import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { formatPrice, formatShortDate } from '../businessFormat';
import { IconButton } from '../ui/BusinessParts';

const ICON: Record<string, AdminIconName> = {
  free: 'Users01',
  month: 'Zap',
  year: 'Calendar',
};

/** What a quota line reads on the right: "10", "1 per resume", "Unlimited", or its rule. */
export function quotaValue(quota: PlanQuota): string {
  if (quota.note) return quota.note;
  if (quota.limit === null) return 'Unlimited';
  // A label that already says "per month" takes the bare count (406:3042).
  if (/\bper\b/.test(quota.label)) return formatCount(quota.limit);
  return `${formatCount(quota.limit)} per ${quota.per}`;
}

export type PlanCardProps = {
  plan: AdminPlan;
  /** The card's badge: "Default plan", "63% of Pro", "Save 52%". */
  badge: { label: string; tone: 'neutral' | 'brand' | 'success'; dot?: boolean };
  onEditQuotas: () => void;
};

/**
 * One plan (Figma 406:3042): its price in USD with EUR and AUD under it, how many are on it and
 * the change over 30 days, its quotas, and who last changed them.
 */
export function PlanCard({ plan, badge, onEditQuotas }: PlanCardProps) {
  const free = plan.tier === 'free';
  const per = plan.period === 'year' ? 'year' : 'month';
  const others = `${formatPrice(plan.prices.EUR, 'EUR')} · ${formatPrice(plan.prices.AUD, 'AUD')}`;
  const sub = free
    ? `${others} · no card needed`
    : plan.period === 'year'
      ? `${others} per year · about ${formatPrice(Math.round(plan.prices.USD / 12), 'USD', true)} a month`
      : `${others} per month`;

  return (
    <AdminCard
      icon={free ? ICON.free : ICON[plan.period]}
      title={plan.name}
      trailing={
        <AdminBadge tone={badge.tone} dot={badge.dot}>
          {badge.label}
        </AdminBadge>
      }
      bodyClassName="gap-0"
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-display-l font-semibold tracking-display text-text-primary">
            {formatPrice(plan.prices.USD, 'USD')}
          </span>
          <span className="text-body-m text-text-secondary">/ {per}</span>
        </p>
        <p className="text-body-s text-text-secondary">{sub}</p>
      </div>

      <div className="mt-5 flex items-center gap-3 border-y border-neutral-100 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-body-s text-text-secondary">
            {free ? 'Active users on Free' : 'Active subscribers'}
          </p>
          <p className="text-admin-price text-text-primary">
            {plan.active === null ? '—' : formatCount(plan.active)}
          </p>
        </div>
        {plan.activeDelta !== null && (
          <div className="flex flex-col items-end gap-0.5">
            <TrendBadge up={plan.activeDelta >= 0}>
              {plan.activeDelta >= 0 ? '+' : '−'}
              {formatCount(Math.abs(plan.activeDelta))}
            </TrendBadge>
            <span className="text-caption-m font-normal text-text-tertiary">last 30 days</span>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <h3 className="text-body-s font-semibold text-neutral-700">Quotas</h3>
        <ul className="flex flex-col gap-3">
          {plan.quotas.map((quota) => (
            <li key={quota.key} className="flex items-center gap-3 text-body-s">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600"
              >
                <AdminIcon name="Check" size="xs" />
              </span>
              <span className="min-w-0 flex-1 truncate text-neutral-700">{quota.label}</span>
              <span className="font-semibold tabular-nums text-text-primary">
                {quotaValue(quota)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <p className="min-w-0 flex-1 text-caption-m font-normal text-text-tertiary">
          {plan.quotasChanged
            ? `Quotas last changed ${formatShortDate(plan.quotasChanged.at)} by ${plan.quotasChanged.by}`
            : 'Quota history isn’t reported yet'}
        </p>
        <IconButton
          icon="Edit03"
          onClick={onEditQuotas}
          aria-label={`Edit quotas for ${plan.name}`}
          className={adminButton.small}
        >
          Edit quotas
        </IconButton>
      </div>
    </AdminCard>
  );
}

export function PlanCardSkeleton() {
  return (
    <div aria-hidden className="rounded-lg border border-neutral-200 bg-neutral-50 p-1">
      <Skeleton className="m-3 h-4 w-28" />
      <div className="flex flex-col gap-4 rounded-md border border-neutral-200 bg-surface-card p-5">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-14 w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

/** The badge each plan's card wears, worked out from the plans themselves. */
export function planBadge(plan: AdminPlan, plans: AdminPlan[]): PlanCardProps['badge'] {
  if (plan.tier === 'free') return { label: 'Default plan', tone: 'neutral' };
  const pro = plans.filter((p) => p.tier === 'pro');
  if (plan.period === 'year') {
    const monthly = pro.find((p) => p.period === 'month');
    if (monthly && monthly.prices.USD > 0) {
      const save = 1 - plan.prices.USD / (monthly.prices.USD * 12);
      return { label: `Save ${formatRate(save, 0)}`, tone: 'success', dot: true };
    }
  }
  const total = pro.reduce((sum, p) => sum + (p.active ?? 0), 0);
  if (plan.active !== null && total > 0) {
    return { label: `${formatRate(plan.active / total, 0)} of Pro`, tone: 'brand' };
  }
  return { label: plan.period === 'year' ? 'Annual' : 'Monthly', tone: 'brand' };
}
