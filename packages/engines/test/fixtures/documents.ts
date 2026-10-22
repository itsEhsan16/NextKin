/**
 * Synthetic documents for the engine suites (L4: synthetic only). A backend JD, a profile and the
 * resume generated from it, and a nurse's resume for the mismatched-profession case.
 */

import type { FormatFacts, ScoringDocument } from '../../src/document';
import { KB } from '../../src/datasets/kb';
import { TAXONOMY } from '../../src/datasets/taxonomy';
import type { KbEntry, KnowledgeBase } from '../../src/kb';
import { requirementsFromJd } from '../../src/requirements';
import type { ScoreInput } from '../../src/rubric';

export const AS_OF = { year: 2026, month: 10 };

export const CLEAN_FORMAT: FormatFacts = {
  singleColumn: true,
  standardHeadings: true,
  noTablesOrImages: true,
  standardFonts: true,
  contactInBody: true,
};

/** The starter KB with every entry approved: what a curated KB will behave like. */
export function approvedKb(overrides: Partial<Record<string, Partial<KbEntry>>> = {}): KnowledgeBase {
  return {
    id: 'kb',
    version: 'kb-test-approved',
    entries: KB.entries.map((e) => ({ ...e, reviewState: 'admin_approved' as const, ...overrides[e.skillId] })),
  };
}

export const BACKEND_JD_TEXT = [
  'Senior Backend Engineer at Acme Payments, Berlin, Germany.',
  'We are looking for an engineer to build reliable payment services for millions of merchants.',
  'Requirements: 5+ years of experience with Go and PostgreSQL. Strong Kubernetes and Docker skills.',
  'Experience with Kafka is required. Nice to have: Terraform, gRPC and Redis.',
  'You must be authorized to work in the EU. Fluent English is required.',
].join('\n');

export const BACKEND_JD = {
  requiredSkills: ['Go', 'PostgreSQL', 'Kubernetes', 'Docker', 'Kafka'],
  preferredSkills: ['Terraform', 'gRPC', 'Redis'],
  tools: [],
  rawText: BACKEND_JD_TEXT,
};

export const BACKEND_REQUIREMENTS = requirementsFromJd(BACKEND_JD, TAXONOMY);

/** The profile the backend resume is generated from. */
export const BACKEND_PROFILE: ScoringDocument = {
  summary: 'Backend engineer with eight years of experience building payment platforms and the services and data pipelines behind them.',
  skills: ['Go', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis', 'Python', 'Terraform'],
  roles: [
    {
      id: 'role_pay',
      title: 'Senior Backend Engineer',
      company: 'Lumen Pay',
      start: { year: 2020, month: 3 },
      end: null,
      skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Docker', 'Redis', 'Terraform'],
      bullets: [
        'Built the settlement service in Go handling 2M transactions a day',
        'Cut p99 latency of the ledger API by 45% by reworking PostgreSQL indexes',
        'Moved 40 services onto Kubernetes with zero downtime',
      ],
    },
    {
      id: 'role_shop',
      title: 'Backend Developer',
      company: 'Cartwheel',
      start: { year: 2016, month: 1 },
      end: { year: 2020, month: 2 },
      skills: ['Python', 'PostgreSQL', 'Docker'],
      bullets: [
        'Developed order APIs in Python for 300 merchants',
        'Introduced Docker for local development across a team of 12',
        'Maintained the PostgreSQL schema for the catalogue',
      ],
    },
  ],
  education: [{ institution: 'TU Example', degree: 'BSc Computer Science' }],
  contact: { email: true, phone: true, location: true },
};

/** The resume generated from the profile, against the backend JD. */
export const BACKEND_RESUME: ScoringDocument = {
  ...BACKEND_PROFILE,
  skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Docker', 'Redis', 'Terraform'],
};

export const NURSE_RESUME: ScoringDocument = {
  summary: 'Registered nurse with six years of experience in acute care, patient education and medication administration on busy wards.',
  skills: ['Patient care', 'Phlebotomy', 'Electronic health records', 'Basic life support'],
  roles: [
    {
      id: 'role_ward',
      title: 'Registered Nurse',
      company: 'St Example Hospital',
      start: { year: 2019, month: 4 },
      end: null,
      skills: ['Patient care', 'Medication administration', 'EHR'],
      bullets: [
        'Cared for up to 8 patients per shift on a 30-bed surgical ward',
        'Administered medication and documented care in the EHR',
        'Trained 5 new nurses on ward procedures',
      ],
    },
  ],
  education: [{ institution: 'Example University', degree: 'Bachelor of Nursing' }],
  contact: { email: true, phone: true, location: true },
};

export function backendInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    document: BACKEND_RESUME,
    format: CLEAN_FORMAT,
    jd: { requirements: BACKEND_REQUIREMENTS, text: BACKEND_JD_TEXT, completeness: 'full' },
    profile: BACKEND_PROFILE,
    kb: KB,
    taxonomy: TAXONOMY,
    asOf: AS_OF,
    ...overrides,
  };
}
