'use client';

import { useState } from 'react';

import type { AdminJobProvider } from '@nextkin/shared/models';
import { useSetProviderEnabled } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Switch } from '@/ui/Switch';

import { formatCount, formatRate } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { adminButton } from '../../ui/adminButton';
import { formatShortDate } from '../businessFormat';
import { IconButton, Track } from '../ui/BusinessParts';
import { CeilingField, ErrorSparkline, KeyDialog } from './ProviderParts';

/** Each provider's avatar tint, in the boards' order (408:3766–408:3811). */
const TINT = [
  'bg-warning-50 text-warning-600',
  'bg-info-50 text-info-600',
  'bg-brand-100 text-brand-700',
  'bg-neutral-100 text-neutral-700',
];

/** A quota this far used turns its meter amber (Adzuna's 62%). */
const QUOTA_WARN = 0.6;
/** An error rate at or above this is amber, and its badge points up. */
const ERROR_WARN = 0.01;

/** The boards' short names (AZ, JB, US, RM); another provider takes its first two letters. */
const INITIALS: Record<string, string> = {
  adzuna: 'AZ',
  jooble: 'JB',
  usajobs: 'US',
  remotive: 'RM',
};
const initials = (provider: string, label: string) =>
  INITIALS[provider] ??
  label
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase();

/** An error rate with one decimal, as the board writes it: "0.0%", "4.1%". */
const errorText = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/**
 * One job provider (Figma 408:3766): its health and the switch that pauses it, the write-only key,
 * today's calls against the daily ceiling, the error rate, and the attribution the provider asks
 * for. Every change is audited.
 */
export function ProviderCard({ provider, index }: { provider: AdminJobProvider; index: number }) {
  const toggle = useSetProviderEnabled();
  const [keyOpen, setKeyOpen] = useState(false);
  const { used, ceiling } = provider.quota;
  const share = used !== null && ceiling ? used / ceiling : null;
  const subtitle = provider.pausedBy
    ? `${provider.subtitle} · paused by ${provider.pausedBy.name} on ${formatShortDate(provider.pausedBy.at)}`
    : provider.subtitle;
  // No measured rate (paused, or just back on) claims no health: the line stays slate.
  const errorTone =
    !provider.enabled || provider.errorRate === null
      ? 'neutral'
      : provider.errorRate >= ERROR_WARN
        ? 'warning'
        : 'success';

  return (
    <section
      aria-label={provider.label}
      className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50 px-1 pb-1"
    >
      <header className="flex items-center gap-3 py-3.5 pl-3.5 pr-2.5">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-900/10 text-body-s font-semibold',
            TINT[index % TINT.length],
          )}
        >
          {initials(provider.provider, provider.label)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-body-m font-semibold text-text-primary">{provider.label}</h2>
          <p className="truncate text-caption-m font-normal text-text-tertiary">{subtitle}</p>
        </div>
        {provider.health === 'degraded' && (
          <AdminBadge tone="warning" dot>
            Degraded
          </AdminBadge>
        )}
        {provider.health === 'healthy' && (
          <AdminBadge tone="success" dot>
            Healthy
          </AdminBadge>
        )}
        {provider.health === 'paused' && (
          <AdminBadge tone="neutral" dot>
            Paused
          </AdminBadge>
        )}
        {/* A label around the switch gives it a 44px hit area that a click passes on to it; it
            stays focusable while a change saves, so focus doesn't fall to the page. */}
        <label
          aria-busy={toggle.isPending || undefined}
          className="relative isolate flex cursor-pointer after:absolute after:-inset-3 after:-z-10"
        >
          <Switch
            checked={provider.enabled}
            label={`${provider.label} ${provider.enabled ? 'on' : 'off'}`}
            onChange={(enabled) =>
              !toggle.isPending &&
              toggle.mutate(
                { provider: provider.provider, enabled },
                {
                  onSuccess: () =>
                    showToast(
                      enabled ? `${provider.label} is back on` : `${provider.label} paused`,
                    ),
                  onError: (error) =>
                    showToast(error instanceof Error ? error.message : 'That didn’t save.', {
                      tone: 'error',
                    }),
                },
              )
            }
          />
        </label>
      </header>

      <div className="flex flex-1 flex-col rounded-md border border-neutral-200 bg-surface-card px-5 py-1 shadow-xs">
        <Row>
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-neutral-200 text-neutral-600 shadow-xs"
          >
            <AdminIcon name="Key01" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-center gap-2 text-body-s font-semibold text-text-primary">
              API key
              {provider.key.set ? (
                <AdminBadge tone="success" icon={<AdminIcon name="Lock01" size="xs" />}>
                  Key set
                </AdminBadge>
              ) : (
                <AdminBadge tone="warning">No key</AdminBadge>
              )}
            </p>
            <p className="truncate text-body-s text-text-secondary">
              {provider.key.set
                ? `${provider.key.addedAt ? `Added ${formatShortDate(provider.key.addedAt)}${provider.key.addedBy ? ` by ${provider.key.addedBy}` : ''} · ` : ''}write-only, never shown`
                : 'Add a key before turning this provider on'}
            </p>
          </div>
          <IconButton
            icon="Key01"
            onClick={() => setKeyOpen(true)}
            aria-label={`${provider.key.set ? 'Replace' : 'Add'} the ${provider.label} key`}
            className={adminButton.small}
          >
            {provider.key.set ? 'Replace key' : 'Add key'}
          </IconButton>
        </Row>

        <Row className="items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-body-s">
              <span className="font-semibold text-text-primary">Quota today</span>
              <span className="font-medium text-neutral-700">
                {used === null
                  ? 'Not reported yet'
                  : `${formatCount(used)} of ${ceiling === null ? '—' : formatCount(ceiling)} calls`}
              </span>
            </div>
            <Track
              share={share ?? 0}
              fill={share !== null && share >= QUOTA_WARN ? 'bg-warning-600' : 'bg-brand-600'}
              label={`${provider.label} quota used today`}
            />
            <p className="text-caption-m font-normal text-text-tertiary">
              {!provider.enabled
                ? 'No calls while paused'
                : share === null
                  ? 'Calls per day aren’t reported yet'
                  : `${formatRate(share, 0)} used`}{' '}
              · resets at 00:00 UTC
            </p>
          </div>
          <CeilingField provider={provider} />
        </Row>

        <Row>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-s font-semibold text-text-primary">Error rate</p>
            <p className="truncate text-body-s text-text-secondary">
              {provider.errorNote ?? 'Not reported yet'}
            </p>
          </div>
          <ErrorSparkline values={provider.errorTrend} tone={errorTone} />
          <span className="flex w-16 justify-end">
            {provider.errorRate === null ? (
              <AdminBadge tone="neutral">n/a</AdminBadge>
            ) : provider.errorRate >= ERROR_WARN ? (
              <AdminBadge tone="warning" icon={<AdminIcon name="ArrowUp" size="xs" />}>
                {errorText(provider.errorRate)}
              </AdminBadge>
            ) : (
              <AdminBadge tone="success">{errorText(provider.errorRate)}</AdminBadge>
            )}
          </span>
        </Row>

        <Row className="border-b-0">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-s font-semibold text-text-primary">Attribution requirement</p>
            <p className="truncate text-body-s text-text-secondary">
              {provider.attribution?.rule ?? 'Not reported yet'}
            </p>
          </div>
          {provider.attribution && (
            <AdminBadge
              tone={provider.attribution.state === 'shown' ? 'success' : 'neutral'}
              icon={<AdminIcon name="Check" size="xs" />}
            >
              {provider.attribution.state === 'shown'
                ? 'Shown on results'
                : 'Enforced when enabled'}
            </AdminBadge>
          )}
        </Row>
      </div>

      {keyOpen && <KeyDialog provider={provider} onClose={() => setKeyOpen(false)} />}
    </section>
  );
}

function Row({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-4 border-b border-neutral-100 py-4', className)}>
      {children}
    </div>
  );
}
