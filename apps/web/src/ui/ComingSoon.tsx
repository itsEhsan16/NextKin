import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ArrowRightIcon, ClockIcon } from './icons';
import { buttonClass } from './Button';
import { StatusPage } from './StatusPage';

export type ComingSoonLink = { label: string; href: Route };

export type ComingSoonProps = {
  title: string;
  /** The V2 section the page will implement, so the gap stays legible to the team. */
  section: string;
  /** One sentence, in the reader's terms, on what the page will do. */
  description: string;
  /** An existing illustration for the area. Decorative. */
  art?: ReactNode;
  /** The nearest thing that works today ("Find a job instead"), offered first. */
  alternative?: ComingSoonLink;
  /** The way back; Home unless the page has a more natural parent. */
  back?: ComingSoonLink;
};

/**
 * A destination the app links to but this milestone doesn't build (SYS 08, 871:1125;
 * `toreview.md` §85): the page's name beside a way back, its art, a "Coming soon" pill, what the
 * page will do in the reader's terms, and the nearest thing that works today. `section` stays in
 * the copy for the team; the board prints no planning note.
 */
export function ComingSoon({
  title,
  description,
  art,
  alternative,
  back = { label: 'Back to Home', href: '/' as Route },
}: ComingSoonProps) {
  const next = alternative ?? back;
  return (
    <StatusPage
      name={title}
      backHref={back.href}
      art={art}
      pill={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption-m font-semibold text-text-brand">
          <ClockIcon aria-hidden className="size-3" />
          Coming soon
        </span>
      }
      heading={`${title} is coming soon`}
      message={description}
      action={
        <Link href={next.href} className={buttonClass({ variant: 'secondary', size: 'lg' })}>
          {next.label}
          <ArrowRightIcon aria-hidden className="size-3.5" />
        </Link>
      }
    />
  );
}
