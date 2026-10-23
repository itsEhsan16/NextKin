import { texOf } from './jakeTemplate';
import { LATEX_STYLES } from './styles';
import type { LatexDensity, LatexResume } from './types';

/**
 * The documents the `latex` image compiles at build time (docker/Dockerfile, toreview §111), so
 * Tectonic's cache holds exactly the TeX and font files production compiles need: the template's
 * own output for every density × paper, from a synthetic resume (L4) that exercises every
 * section kind, nesting, inline and own-line tech, and an escaped link.
 *
 * Every template loads two faces only, regular and bold (toreview §130), and this resume reaches
 * both, so the cache holds every font file a compile can ask for.
 */

const PAPERS: LatexResume['paper'][] = ['letter', 'a4'];
const DENSITIES: LatexDensity[] = [0, 1, 2];

/** Synthetic (L4). The link with %20 checks that `\%` reaches the PDF as a literal percent. */
export function warmupResume(density: LatexDensity, paper: LatexResume['paper']): LatexResume {
  return {
    name: 'Jordan Avery',
    headline: 'Software engineer -- web platforms',
    contact: [
      { text: 'Springfield, USA' },
      { text: '+1 555 010 0100', url: 'tel:+15550100100' },
      { text: 'jordan@example.com', url: 'mailto:jordan@example.com' },
      { text: 'example.com/jordan avery', url: 'https://example.com/jordan%20avery_cv' },
    ],
    density,
    paper,
    sections: [
      { kind: 'paragraph', heading: 'Summary', text: 'Builds web apps end to end: React, Node & Postgres; 100% test coverage on billing.' },
      {
        kind: 'entries',
        heading: 'Experience',
        entries: [
          {
            title: 'Northwind',
            titleNote: '(northwind.example)',
            right: 'Jan 2022 -- Present',
            subtitle: 'Senior Engineer',
            subtitleBold: true,
            subRight: 'Remote',
            bullets: ['Led a team of 4 to rebuild checkout, cutting drop-off by 12%.', 'Moved nightly reports onto a queue.'],
            children: [{ title: 'Acme Health', right: '2023', subtitle: 'Client project', tech: 'Next.js, Go', bullets: ['Built the patient portal.'] }],
          },
        ],
      },
      { kind: 'entries', heading: 'Projects', entries: [{ title: 'Shortlink', tech: 'TypeScript, SQL', techInline: true, right: '2021', bullets: ['A link shortener with analytics [beta].'] }] },
      { kind: 'lines', heading: 'Technical Skills', lines: [{ label: 'Languages', text: 'TypeScript, Go, SQL' }, { text: 'AWS Certified Developer' }] },
    ],
  };
}

/** Every template × density × paper; Classic's names are the ones the image has always used. */
export function warmupSources(): { name: string; tex: string }[] {
  return Object.values(LATEX_STYLES).flatMap((style) =>
    PAPERS.flatMap((paper) =>
      DENSITIES.map((density) => ({
        name: `warmup-${style.slug === 'jake' ? '' : `${style.slug}-`}${paper}-${density}.tex`,
        tex: texOf(warmupResume(density, paper), style),
      })),
    ),
  );
}

