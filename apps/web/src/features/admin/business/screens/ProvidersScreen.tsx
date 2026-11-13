'use client';

import { useAdminJobProviders } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';
import { StateView } from '@/ui/StateView';

import { CardEmpty } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { ProviderCard } from '../providers/ProviderCard';
import { NoteBar } from '../ui/BusinessParts';

/**
 * Job providers (Figma 408:3596): each search source with its health and on/off switch, its
 * write-only key, today's calls against the daily ceiling, its error rate and the attribution it
 * asks for. Every change is audited.
 */
export function ProvidersScreen() {
  const providers = useAdminJobProviders();

  return (
    <AdminPage
      title="Job providers"
      subtitle="Job search sources, their keys, daily call ceilings and attribution rules. Every change is audited."
      actions={
        // Providers are set up in code and seeded; adding one from here has no backend yet.
        <Soon label="Adding a provider is coming soon">
          <button type="button" aria-disabled="true" className={cn(adminButton.primary, adminSoon)}>
            <AdminIcon name="Plus" />
            Add provider
          </button>
        </Soon>
      }
    >
      {providers.isPending ? (
        <div aria-hidden className="grid gap-4 @admin-lg/admin:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[415px] rounded-lg" />
          ))}
        </div>
      ) : providers.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load the job providers"
          message="Search keeps running on its current settings."
          actionLabel="Try again"
          onAction={() => void providers.refetch()}
        />
      ) : providers.data.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-surface-card">
          <CardEmpty title="No job providers" message="Job search has no sources set up yet." />
        </div>
      ) : (
        <div className="grid gap-4 @admin-lg/admin:grid-cols-2">
          {providers.data.map((provider, index) => (
            <ProviderCard key={provider.provider} provider={provider} index={index} />
          ))}
        </div>
      )}

      <NoteBar icon="Lock01" title="Provider keys">
        Keys are write-only. Once saved, nobody can see them again; replace a key to change it.
      </NoteBar>
    </AdminPage>
  );
}
