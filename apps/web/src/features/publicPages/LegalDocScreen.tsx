'use client';

import type { LegalDocKey } from '@nextkin/shared/models';
import { useLegal } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { useReveal } from '@/lib/useReveal';
import { cardSurface } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { PublicShell } from './PublicShell';

const card = cn(cardSurface, 'rounded-xl p-5.5 shadow-card');

/**
 * A legal document's public page (V2 §8.5): the published version the API serves, readable with
 * no account. The app links here (mobile `LegalScreen`'s "Open on the web", web `PolicyCard`),
 * and so do the Play listing and its Data safety form, which need a public, non-PDF address.
 */
export function LegalDocScreen({ doc }: { doc: LegalDocKey }) {
  const legal = useLegal(doc);
  const reveal = useReveal(Boolean(legal.data));

  return (
    <PublicShell>
      {!legal.data && !legal.isError && (
        <div className="flex flex-col gap-4" role="status" aria-busy>
          <span className="sr-only">Loading the document</span>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}
      {!legal.data && legal.isError && (
        <StateView
          className="mt-10"
          tone="danger"
          title="Couldn’t load this document"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void legal.refetch()}
        />
      )}
      {legal.data && (
        <article className={cn('flex flex-col gap-4', reveal && 'animate-reveal')}>
          <section className={card}>
            <h1 className="text-h2 font-bold text-text-primary">{legal.data.title}</h1>
            <p className="mt-1 text-body-s text-text-tertiary">
              Last updated {formatShortDate(legal.data.updatedAt)}
            </p>
            <p className="mt-4 text-body-m text-text-secondary">{legal.data.intro}</p>
          </section>
          {legal.data.sections.map((section, index) => (
            <section key={section.id} id={section.id} className={card}>
              <h2 className="text-title-l font-semibold text-text-primary">
                {index + 1}. {section.heading}
              </h2>
              {section.body.split('\n\n').map((paragraph, i) => (
                <p key={i} className="mt-3 text-body-m text-text-secondary">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>
      )}
    </PublicShell>
  );
}
