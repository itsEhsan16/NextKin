import { LEGAL_DOC_TITLE, type LegalDocKey } from '@nextkin/shared/models';
import { useLegal } from '@nextkin/shared/queries';
import type { ComponentType, SVGProps } from 'react';

import { formatShortDate } from '@/lib/format';
import { ChevronRightIcon } from '@/ui/icons';
import { ProfileTermsIllustration, SettingsSecurityIllustration } from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { useReveal } from '@/lib/useReveal';
import { cardInteractive, cardPad, cardSurface } from '@/ui/Card';
import { cn } from '@/lib/cn';

const ART: Record<LegalDocKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  terms: ProfileTermsIllustration,
  privacy: SettingsSecurityIllustration,
};

/**
 * "Terms of service" and "Privacy policy" (577:6625, 6650): each document's title, when it last
 * changed and its one-paragraph summary, read off the shared legal documents (V2 §8.5). The board
 * draws a chevron to the full text; web has no page for it yet, so the card opens the canonical
 * copy in a new tab (`toreview.md` §94).
 */
export function PolicyCard({ doc }: { doc: LegalDocKey }) {
  const legal = useLegal(doc);
  const Art = ART[doc];
  const reveal = useReveal(Boolean(legal.data));

  // A summary that didn't load says so and can be asked for again (redesign R7a, audit HP-01).
  if (!legal.data && legal.isError)
    return (
      <div className={cn(cardSurface, cardPad, 'flex flex-col gap-2')}>
        <p className="text-title-l text-text-primary">{LEGAL_DOC_TITLE[doc]}</p>
        <p className="text-body-m text-text-secondary">Couldn’t load the summary.</p>
        <button
          type="button"
          onClick={() => void legal.refetch()}
          className="w-fit rounded-sm text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Try again
        </button>
      </div>
    );
  if (!legal.data) return <Skeleton className="h-40 rounded-lg" />;

  const { title, updatedAt, intro, url } = legal.data;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        cardSurface,
        cardPad,
        cardInteractive,
        'group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        reveal && 'animate-reveal',
      )}
    >
      <span className="flex items-center gap-3">
        <span aria-hidden className="flex w-10 shrink-0 justify-center">
          <Art className="h-auto max-h-9 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-title-l text-text-primary">{title}</span>
          <span className="block text-body-s text-text-tertiary">
            Last updated {formatShortDate(updatedAt)}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-text-secondary transition-transform duration-press ease-standard group-hover:translate-x-0.5"
        />
      </span>
      <span className="mt-4 block text-body-m text-text-secondary">{intro}</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
