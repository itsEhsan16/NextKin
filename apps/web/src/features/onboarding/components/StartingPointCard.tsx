import Link from 'next/link';

import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { EditIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';

/** How many skills the card lists before "+N more". */
const SHOWN = 6;

/**
 * ONB 08's starting point (816:186): initials, the name and where they are heading, a "Draft ·
 * check it" badge that opens the profile, the summary built from the answers, and the skills.
 */
export function StartingPointCard({
  name,
  initials,
  headline,
  summary,
  skills,
}: {
  name: string;
  initials: string;
  headline: string;
  summary: string;
  skills: readonly string[];
}) {
  const more = skills.length - SHOWN;
  return (
    <section
      aria-label="Your starting point"
      className={cn(cardSurface, cardPad, 'flex flex-col gap-4 animate-reveal')}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-body-l font-bold text-text-brand"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-h2 font-bold text-text-primary">{name}</p>
          {headline && (
            <p className="truncate text-body-m font-medium text-text-secondary">{headline}</p>
          )}
        </div>
        <Link
          href="/profile"
          className={cn(
            pressable,
            'flex shrink-0 items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-body-s font-semibold text-warning-text hover:bg-warning-50/70',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          )}
        >
          <EditIcon aria-hidden className="size-3" />
          Draft · check it
        </Link>
      </div>
      {summary && <p className="text-prose text-neutral-700">{summary}</p>}
      {skills.length > 0 && (
        <ul aria-label="Skills" className="flex flex-wrap gap-2">
          {skills.slice(0, SHOWN).map((skill) => (
            <li
              key={skill}
              className="rounded-full bg-neutral-100 px-3 py-1 text-body-s font-medium text-neutral-700"
            >
              {skill}
            </li>
          ))}
          {more > 0 && (
            <li className="px-1 py-0.5 text-body-s font-medium text-text-tertiary">+{more} more</li>
          )}
        </ul>
      )}
    </section>
  );
}
