'use client';

import type { JdReading, JdSectionKind } from '@nextkin/shared/jobs/jdSections';
import { REMOTE_TYPE_LABEL } from '@nextkin/shared/models';
import type { PlausibilityNote } from '@nextkin/shared/scoring/plausibility';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { AlertTriangle } from '@/ui/lineIcons';
import {
  InsightsStarIllustration,
  JdArtDocumentSearchIllustration,
  ProfileCompanyIllustration,
  ProfileGoalsIllustration,
  ProfileLocationIllustration,
  ProfilePaperPlaneIllustration,
  ProfileSkillsIllustration,
  SettingsBillingIllustration,
} from '@/ui/illustrations';

import { Bullets, JobSection } from '../../jobs/components/page/JobSections';

type Art = ComponentType<SVGProps<SVGSVGElement>>;

const KIND: Partial<Record<JdSectionKind, { title: string; Art: Art }>> = {
  responsibilities: { title: 'Responsibilities', Art: ProfileGoalsIllustration },
  preferred: { title: 'Preferred qualifications', Art: ProfileSkillsIllustration },
  benefits: { title: 'Benefits', Art: InsightsStarIllustration },
  compensation: { title: 'Pay', Art: SettingsBillingIllustration },
  location: { title: 'Where you’ll work', Art: ProfileLocationIllustration },
  about_company: { title: 'About the company', Art: ProfileCompanyIllustration },
  how_to_apply: { title: 'How to apply', Art: ProfilePaperPlaneIllustration },
  other: { title: 'More from the posting', Art: JdArtDocumentSearchIllustration },
};

/** The order the page shows them in, after the summary and what the job asks for. */
const ORDER: readonly JdSectionKind[] = [
  'preferred',
  'benefits',
  'compensation',
  'location',
  'about_company',
  'how_to_apply',
  'other',
];

function Lines({ paragraphs, items }: { paragraphs: readonly string[]; items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((p) => (
        <p key={p} className="text-body-m text-text-secondary">
          {p}
        </p>
      ))}
      {items.length > 0 && <Bullets items={items} />}
    </div>
  );
}

/**
 * The rest of the posting, section by section, as the JD wrote it (toreview §129): what it would
 * like, its benefits, pay, where the work is, the company and how to apply. Each kind once, its
 * lines in the JD's order. Responsibilities come from the reading only when the extraction found
 * none. Pay and the work arrangement are read by code from the text, never guessed.
 */
export function JdReadingSections({
  reading,
  withResponsibilities,
}: {
  reading: JdReading;
  withResponsibilities: boolean;
}) {
  const kinds: readonly JdSectionKind[] = withResponsibilities
    ? ['responsibilities', ...ORDER]
    : ORDER;
  return (
    <>
      {kinds.map((kind) => {
        const meta = KIND[kind];
        const parts = reading.sections.filter((s) => s.kind === kind);
        const paragraphs = parts.flatMap((s) => s.paragraphs);
        const items = parts.flatMap((s) => s.items);
        const salary = kind === 'compensation' ? reading.salary : undefined;
        const arrangement = kind === 'location' ? reading.workArrangement : undefined;
        if (!meta || (!paragraphs.length && !items.length && !salary && !arrangement)) return null;
        return (
          <JobSection key={kind} id={`jd-${kind}`} Art={meta.Art} title={meta.title}>
            {(salary || arrangement) && (
              <p className="mb-3 inline-flex rounded-md bg-neutral-50 px-3 py-1.5 text-body-m font-semibold text-text-primary">
                {salary ?? REMOTE_TYPE_LABEL[arrangement!]}
              </p>
            )}
            <Lines paragraphs={paragraphs} items={items} />
          </JobSection>
        );
      })}
    </>
  );
}

/**
 * "Requirements to double-check" (toreview §129): what the JD asks that nobody could have, such as
 * 20 years of a technology released 13 years ago, each with what it rests on and what the score
 * does about it. `impossible` rests on reviewed technology dates; `suspect` on dates not reviewed
 * yet, or on a working life's length.
 */
export function JdPlausibilityCallout({ notes }: { notes: readonly PlausibilityNote[] }) {
  if (notes.length === 0) return null;
  return (
    <section
      aria-labelledby="jd-plausibility"
      className="mx-8 mb-2 mt-1 rounded-md bg-warning-50 px-5 py-4"
    >
      <h2
        id="jd-plausibility"
        className="flex items-center gap-2 text-body-m font-bold text-warning-text"
      >
        <AlertTriangle aria-hidden className="size-4" />
        Requirements to double-check
      </h2>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {notes.map((note) => (
          <li key={`${note.code}:${note.skill ?? note.title}`} className="text-body-m">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
              {note.title}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-caption-m font-semibold',
                  note.severity === 'impossible'
                    ? 'bg-danger-50 text-danger-text'
                    : 'bg-surface-card text-warning-text',
                )}
              >
                {note.severity === 'impossible' ? 'Not possible' : 'Looks off'}
              </span>
            </p>
            <p className="mt-0.5 text-text-secondary">{note.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
