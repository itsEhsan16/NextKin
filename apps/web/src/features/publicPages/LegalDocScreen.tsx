'use client';

import { LEGAL_DOCS } from '@nextkin/shared/legal';
import type { LegalDocKey } from '@nextkin/shared/models';
import { useLegal } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { cardSurface } from '@/ui/Card';

import { PublicShell } from './PublicShell';

const card = cn(cardSurface, 'rounded-xl p-5.5 shadow-card');

/**
 * A legal document's public page (V2 §8.5): the published version the API serves, readable with
 * no account. The app links here (mobile `LegalScreen`'s "Open on the web", web `PolicyCard`),
 * and so do the Play listing and its Data safety form, which need a public, non-PDF address.
 *
 * The shipped text (`@nextkin/shared/legal`) renders first, on the server too, so Google's OAuth
 * review and crawlers read the whole document without JavaScript, and a failed request still
 * leaves it readable (toreview §264). The version the API publishes replaces it when it arrives.
 */
export function LegalDocScreen({ doc }: { doc: LegalDocKey }) {
  const legal = useLegal(doc);
  const shown = legal.data ?? LEGAL_DOCS[doc];

  return (
    <PublicShell>
      <article className="flex flex-col gap-4">
        <section className={card}>
          <h1 className="text-h2 font-bold text-text-primary">{shown.title}</h1>
          <p className="mt-1 text-body-s text-text-tertiary">
            Last updated {formatShortDate(shown.updatedAt)}
          </p>
          <p className="mt-4 text-body-m text-text-secondary">{shown.intro}</p>
        </section>
        {shown.sections.map((section, index) => (
          <section key={section.id} id={section.id} className={card}>
            <h2 className="text-title-l font-semibold text-text-primary">
              {index + 1}. {section.heading}
            </h2>
            {section.body.split('\n\n').map((paragraph, i) => (
              <p key={i} className="mt-3 whitespace-pre-line text-body-m text-text-secondary">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
