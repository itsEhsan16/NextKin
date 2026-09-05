import type { JdDraft } from '@/data/models/jd';

import { hoursAgo } from './time';

/**
 * NextKin V2 spec §7.5 — what the mock JD extractor is able to recognise, plus the one saved
 * extraction the JD history opens with. No artboard covers this flow (plan §8, phase 9).
 */

/**
 * The vocabulary `extractJdDraft` matches a description against. Lowercase because matching is
 * case-insensitive; the draft keeps whatever casing the description itself used.
 *
 * A real extractor runs a model over the text — this list is the mock's stand-in for one, so it
 * stays small, design-led, and honest about the fact that it only knows these words.
 */
export const SKILL_DICTIONARY: readonly string[] = [
  'design systems',
  'user research',
  'prototyping',
  'figma',
  'accessibility',
  'wcag',
  'information architecture',
  'interaction design',
  'usability testing',
  'a/b testing',
  'stakeholder management',
  'design tokens',
  'storybook',
  'mobile ux',
  'ios',
  'android',
  'react native',
  'html',
  'css',
  'javascript',
  'typescript',
  'react',
  'sql',
  'analytics',
  'mixpanel',
  'amplitude',
  'jira',
  'confluence',
  'agile',
  'scrum',
  'roadmapping',
  'wireframing',
  'user flows',
  'personas',
  'journey mapping',
  'design ops',
  'motion design',
  'illustration',
  'data visualisation',
  'localisation',
  'payments',
  'checkout',
  'onboarding',
  'growth',
];

/**
 * One saved draft, extracted from the Stripe listing (`job_stripe` in `jobs.ts`), so the history
 * is not empty on first run and the review screen always has something to open. Every field is
 * exactly what `extractJdDraft` produces for `{ source: 'job', jobId: 'job_stripe' }` — skills
 * split on the listing's tags, `domain` from the company profile, `rawText` the listing rebuilt
 * as the text a user would have pasted — and the test suite asserts that, so the fixture cannot
 * drift away from the extractor.
 *
 * Dated inside the listing's lifetime: `job_stripe` was posted a day ago and saved 12 hours ago,
 * so the extraction has to be more recent than both.
 */
export const jdDraftsFixture: JdDraft[] = [
  {
    id: 'jd_stripe',
    source: 'job',
    title: 'Senior Product Designer',
    company: 'Stripe',
    location: 'Bengaluru',
    experienceLevel: 'senior',
    requiredSkills: ['Design systems', 'Figma'],
    preferredSkills: ['Fintech'],
    responsibilities: [
      'Own onboarding flows across web and mobile',
      'Partner with research to run monthly usability tests',
      'Contribute to and extend the Stripe design system',
      'Mentor two mid-level designers',
    ],
    tools: ['Figma'],
    domain: 'Financial infrastructure',
    rawText: [
      'Senior Product Designer at Stripe — Bengaluru',
      '',
      "You'll join a 12-person design team that owns merchant onboarding end to end — from first API key to first live payment. We work in tight loops with engineering and ship weekly.",
      '',
      'What you will do',
      '- Own onboarding flows across web and mobile',
      '- Partner with research to run monthly usability tests',
      '- Contribute to and extend the Stripe design system',
      '- Mentor two mid-level designers',
      '',
      'Requirements',
      '- 5+ years designing consumer or B2B software',
      '- Deep fluency in Fintech',
      '- Strong portfolio demonstrating shipped, measurable outcomes',
      '- Comfortable writing clear product narratives and specs',
    ].join('\n'),
    jobId: 'job_stripe',
    createdAt: hoursAgo(6),
  },
];
