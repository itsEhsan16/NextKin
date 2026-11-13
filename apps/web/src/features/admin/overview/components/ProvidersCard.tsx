import type { Route } from 'next';

import type { AdminProvider } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { CardMenu } from '../../ui/CardMenu';

/** At or above this error rate a provider's bar and badge turn amber (Figma 396:684). */
const ERROR_WARN = 0.01;

const PROVIDERS = [{ label: 'Open Job providers', href: '/admin/providers' as Route }];

/** An error rate always keeps its decimal, as the board writes "0.0% errors" (396:710). */
const errorRate = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/**
 * Where today's job lookups went (Figma 396:558): each provider's share, its error rate, and
 * whether it is paused. A key is never shown here or anywhere: they are write-only.
 */
export function ProvidersCard({ providers }: { providers: AdminProvider[] | null }) {
  return (
    <AdminCard
      icon="Globe01"
      title="Job providers"
      trailing={<CardMenu label="Job providers" items={PROVIDERS} />}
      bodyClassName="gap-[18px]"
    >
      {!providers ? (
        <NotConnected what="provider traffic or errors" />
      ) : providers.length === 0 ? (
        <CardEmpty
          title="No providers on"
          message="Switch a job provider on to see its traffic here."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-[18px]">
            {providers.map((provider) => (
              <Provider key={provider.provider} provider={provider} />
            ))}
          </ul>
          <p className="mt-auto flex items-center gap-2 border-t border-neutral-100 pt-3 text-body-s text-text-secondary">
            <AdminIcon name="Lock01" size="sm" className="text-neutral-500" />
            Keys are write-only, never shown again
          </p>
        </>
      )}
    </AdminCard>
  );
}

function Provider({ provider }: { provider: AdminProvider }) {
  const warn = provider.errorRate !== null && provider.errorRate >= ERROR_WARN;
  const share = Math.round(provider.share * 100);
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex-1 text-body-s font-semibold',
            provider.enabled ? 'text-text-primary' : 'text-text-tertiary',
          )}
        >
          {provider.label}
        </span>
        {!provider.enabled ? (
          <AdminBadge tone="neutral" dot>
            Paused
          </AdminBadge>
        ) : provider.errorRate === null ? (
          // No calls today: no rate to show, rather than a 0% nobody measured.
          <AdminBadge tone="neutral" dot>
            No calls today
          </AdminBadge>
        ) : (
          <AdminBadge tone={warn ? 'warning' : 'success'} dot>
            {errorRate(provider.errorRate)} errors
          </AdminBadge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div
          role="meter"
          aria-label={`${provider.label}, share of lookups`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share}
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"
        >
          <span
            style={{ width: `${share}%` }}
            className={cn(
              'block h-full animate-meter-grow rounded-full transition-width duration-base ease-standard',
              warn ? 'bg-warning-600' : 'bg-brand-600',
            )}
          />
        </div>
        {/* The share hugs its text, so the track runs to it (396:688–396:724). */}
        <span className="text-body-s font-medium tabular-nums text-neutral-700">{share}%</span>
      </div>
    </li>
  );
}
