import { useId } from 'react';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { PlusIcon } from '@/ui/icons';
import { ArrowRight } from '@/ui/lineIcons';
import {
  JdMatchRobotIllustration,
  JdPasteHeroIllustration,
  JdRobotIllustration,
  JdSamplePageIllustration,
} from '@/ui/illustrations';

import { FILE_BENEFITS, LINK_REASONS, PASTE_BENEFITS, POPULAR_SOURCES } from '../uploadLibrary';
import { BenefitList } from './BenefitList';
import { SourceLogo } from './SourceLogo';

const column = cn(cardSurface, 'flex min-w-0 flex-col p-6');

/**
 * Paste text's column (247:172): the character at her laptop with the board's handwritten line,
 * what NextKin does, and the robot's quote. Both drawings are vectors on the board, each rebuilt
 * from its per-path exports.
 */
export function PasteAside() {
  const headingId = useId();
  return (
    <aside aria-labelledby={headingId} className={column}>
      <JdPasteHeroIllustration className="mx-auto h-[140px] w-auto max-w-full" />
      <h2 id={headingId} className="mt-4 text-h1 text-text-primary">
        Turn job details into opportunities
      </h2>
      <p className="mt-1 text-body-m text-text-secondary">
        Paste the job description and NextKin will:
      </p>
      <BenefitList items={PASTE_BENEFITS} className="mb-4 mt-4" />
      <figure className="mt-auto flex items-center gap-3 rounded-md bg-surface-brand-strong p-4">
        <JdRobotIllustration className="h-16 w-auto shrink-0" />
        <blockquote className="text-body-m text-text-primary">
          “From job description to career insights — in seconds.”
        </blockquote>
      </figure>
    </aside>
  );
}

/** Paste from link's column (244:660): why a link helps, and where links can come from. */
export function LinkAside() {
  const headingId = useId();
  const sourcesId = useId();
  return (
    <aside aria-labelledby={headingId} className={column}>
      <h2 id={headingId} className="text-h1 text-text-primary">
        Why use a job link?
      </h2>
      <BenefitList items={LINK_REASONS} roomy className="mt-6 gap-6" />
      <section aria-labelledby={sourcesId} className="mt-8">
        <h3 id={sourcesId} className="text-h2 font-medium text-text-primary">
          Popular sources
        </h3>
        <ul className="mt-4 grid grid-cols-4 gap-x-1 gap-y-6">
          {POPULAR_SOURCES.map((source) => (
            <li key={source.name} className="flex flex-col items-center gap-1.5 text-center">
              <span className="flex h-12 w-13 items-center justify-center rounded-md bg-neutral-50">
                <SourceLogo name={source.name} className="h-7 w-auto max-w-7" />
              </span>
              <span className="text-body-s text-text-secondary">{source.label}</span>
            </li>
          ))}
          <li className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex h-12 w-13 items-center justify-center rounded-md bg-neutral-50">
              <PlusIcon aria-hidden className="size-6 text-text-tertiary" />
            </span>
            <span className="text-body-s text-text-secondary">And more</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}

/**
 * Upload file's column (247:642): what NextKin does, beside the robot with its speech bubble, and
 * the sample JD. Both drawings are the board's vectors now (261:1016, 261:974), where they used to
 * be rasters, and the robot sits beside the heading, as the board now draws it.
 */
export function FileAside({ onUseSample }: { onUseSample: () => void }) {
  const headingId = useId();
  const sampleId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <aside aria-labelledby={headingId} className={cn(column, 'flex-1')}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={headingId} className="text-h2 text-text-primary">
              Turn a job description into opportunities
            </h2>
            <p className="mt-2 text-body-m text-text-secondary">
              Let NextKin analyze the JD and give you personalized insights in seconds.
            </p>
          </div>
          <JdMatchRobotIllustration className="h-[127px] w-auto shrink-0" />
        </div>
        <BenefitList items={FILE_BENEFITS} className="mt-4" />
      </aside>

      <section
        aria-labelledby={sampleId}
        className="flex items-center gap-4 rounded-lg bg-surface-brand-strong p-6"
      >
        <JdSamplePageIllustration className="h-[79px] w-auto shrink-0" />
        <div className="min-w-0">
          <h2 id={sampleId} className="text-body-l font-semibold text-text-primary">
            Not sure? Try a sample JD
          </h2>
          <p className="mt-1 text-body-s text-text-secondary">
            See how NextKin analyzes a job description with our sample.
          </p>
          <button
            type="button"
            onClick={onUseSample}
            className={cn(
              brandOutlineButton,
              'mt-3 h-control-md gap-2 rounded-md px-4 text-body-m font-semibold',
            )}
          >
            Use sample JD
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
