import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentType, SVGProps } from 'react';

import { Card } from '@/ui/Card';
import { SectionHeader } from '@/ui/SectionHeader';
import {
  AtsCheckIllustration,
  BuildResumeIllustration,
  CoverLetterIllustration,
  ZeroResumeIllustration,
} from '@/ui/illustrations';

type Tile = {
  key: string;
  label: string;
  hint: string;
  href: Route;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Four entry points (286:216, less its "Tailor to a Job": owner, toreview §155). Build Resume is
 * the one flow for a job: its step 2 asks how — tailor a resume you have, build from the profile,
 * start from scratch or upload — so a second tile for tailoring opened the same screens. Zero
 * Resume, Cover Letter and ATS Check are mobile's flows on the web; the hints are the web board's.
 */
const TILES: readonly Tile[] = [
  {
    key: 'build-resume',
    label: 'Build Resume',
    hint: 'For a specific job',
    // Job first, then the resume, the comparison and what to improve (toreview §126).
    href: '/create/build' as Route,
    Art: BuildResumeIllustration,
  },
  {
    key: 'zero-resume',
    label: 'Zero Resume',
    hint: 'Build from scratch',
    href: '/create/zero-resume' as Route,
    Art: ZeroResumeIllustration,
  },
  {
    key: 'cover-letter',
    label: 'Cover Letter',
    hint: 'Personalized letter',
    href: '/create/cover-letter' as Route,
    Art: CoverLetterIllustration,
  },
  {
    key: 'ats-check',
    label: 'ATS Check',
    hint: 'Check your score',
    // A resume against one job, mobile's ATS 01–03 (toreview §125).
    href: '/create/ats-check' as Route,
    Art: AtsCheckIllustration,
  },
];

/**
 * Quick Start, at the compact density: 120px tiles with the board's art at ~72%. Its title goes
 * through `SectionHeader` like every other Home section, rather than the 20px H2 it had alone.
 */
export function QuickStartCard() {
  return (
    <Card className="flex-1 p-6">
      <SectionHeader title="Quick Start" />
      <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {TILES.map(({ key, label, hint, href, Art }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex h-[140px] flex-col items-center justify-end rounded-lg bg-neutral-50 px-2 pb-4 transition-[background-color,box-shadow,translate,scale] duration-base ease-standard hover:-translate-y-0.5 hover:bg-surface-card hover:shadow-card-hover active:scale-(--scale-pressed) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Art className="mb-auto mt-4 h-[56px] w-[52px]" />
              <span className="text-body-m font-semibold text-text-primary">{label}</span>
              <span className="mt-1 text-caption-m text-text-tertiary">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
