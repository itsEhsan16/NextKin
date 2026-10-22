'use client';

import type { TextSection } from '@nextkin/shared/scoring/resumeDiff';

import { cn } from '@/lib/cn';
import { JobAiSparkleIllustration } from '@/ui/illustrations';

/**
 * "Text view" of the review (toreview §121): the resume as text, every section in order, the ones
 * the AI changed tagged "AI enhanced" and their new lines highlighted against the original resume.
 * The download is the typeset page; this is how the changes read.
 */
export function TextView({ sections }: { sections: readonly TextSection[] }) {
  return (
    <div className="flex flex-col gap-5 px-8 py-7">
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <div className="flex items-center justify-between gap-3 border-b border-border-default pb-1">
            <h3 className="text-body-m font-semibold uppercase tracking-wide text-text-primary">
              {section.title}
            </h3>
            {section.changed && (
              <span className="flex items-center gap-1 rounded-full bg-surface-brand-strong px-2 py-0.5 text-caption-m font-semibold text-text-brand">
                <JobAiSparkleIllustration aria-hidden className="h-auto w-3" />
                AI enhanced
              </span>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {section.lines.map((line, i) => (
              <li
                key={`${i}-${line.text}`}
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-body-s leading-relaxed',
                  line.isNew ? 'bg-success-surface text-text-primary' : 'text-text-secondary',
                )}
              >
                {line.isNew && <span className="sr-only">Changed: </span>}
                {line.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
