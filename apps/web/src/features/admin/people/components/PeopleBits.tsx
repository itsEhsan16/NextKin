import type { AdminUserPlan, AdminUserStatus } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { initialsOf } from '../../format';
import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';

/** A person's initials on their tint (Figma 404:885): 36 in a row, 56 in a page header. */
export function PersonAvatar({
  name,
  tint,
  size = 'md',
}: {
  name: string;
  tint: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-neutral-900/8 font-semibold',
        size === 'md' ? 'size-9 text-caption-m' : 'size-14 text-body-s',
        tint,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

const STATUS: Record<AdminUserStatus, { label: string; tone: AdminBadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  deletion_pending: { label: 'Deletion pending', tone: 'warning' },
  comped: { label: 'Comped', tone: 'info' },
  unverified: { label: 'Email unverified', tone: 'neutral' },
};

/** Where an account stands (Figma 404:896): a dotted badge in its tone. */
export function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <AdminBadge tone={tone} dot>
      {label}
    </AdminBadge>
  );
}

/** Free or Pro (Figma 404:891): Pro carries a tick on the indigo tint. */
export function PlanBadge({ plan }: { plan: AdminUserPlan | null }) {
  if (plan === null) return <span className="text-body-s text-text-tertiary">—</span>;
  return plan === 'pro' ? (
    <AdminBadge tone="brand" icon={<AdminIcon name="Check" size="xs" />}>
      Pro
    </AdminBadge>
  ) : (
    <AdminBadge tone="neutral">Free</AdminBadge>
  );
}

/**
 * A usage meter (Figma 404:901): indigo while there's room, amber from 90% of the limit, so the
 * accounts about to hit their limit stand out.
 */
export function UsageBar({
  used,
  limit,
  height = 'sm',
  label,
}: {
  used: number;
  limit: number;
  height?: 'sm' | 'md';
  /** The meter's accessible name: "Generations". */
  label: string;
}) {
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={used}
      aria-valuetext={`${used} of ${limit}`}
      className={cn(
        'flex w-full gap-0.5 overflow-hidden rounded-full',
        height === 'sm' ? 'h-1.5' : 'h-2',
      )}
    >
      {share > 0 && (
        <span
          style={{ width: `${share * 100}%` }}
          className={cn(
            'h-full shrink-0 animate-meter-grow rounded-l-full transition-[width] duration-base ease-standard',
            share >= 1 && 'rounded-r-full',
            share >= 0.9 ? 'bg-warning-600' : 'bg-brand-600',
          )}
        />
      )}
      {share < 1 && <span className="h-full flex-1 rounded-r-full bg-neutral-100" />}
    </div>
  );
}

/** A masked id in a neutral chip: "user ···4f2a" (Figma 408:2843). */
export function IdChip({ children }: { children: string }) {
  return <AdminBadge tone="neutral">{children}</AdminBadge>;
}
