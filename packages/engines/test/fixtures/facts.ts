/**
 * Synthetic profile facts and the known-good resume generated from them (L4: synthetic only).
 */
import type { CanonicalResume, ProfileFacts } from '../../src/facts';

export const FACTS: ProfileFacts = {
  headline: 'Backend engineer',
  summary: 'Backend engineer working on payment systems.',
  skills: ['Go', 'PostgreSQL', 'Docker', 'Kubernetes', 'Python', 'Redis'],
  roles: [
    {
      id: 'r_pay',
      company: 'Lumen Pay',
      title: 'Senior Backend Engineer',
      start: { year: 2020, month: 3 },
      end: null,
      description: 'Owns the settlement platform for 2M transactions a day.',
      responsibilities: [
        'Built the settlement service in Go, processing 2 million transactions daily',
        'Reduced ledger API p99 latency from 800 ms to 440 ms by reworking PostgreSQL indexes',
        'Moved 40 services onto Kubernetes with zero downtime',
      ],
      skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Redis'],
    },
    {
      id: 'r_shop',
      company: 'Cartwheel',
      title: 'Backend Developer',
      start: { year: 2009, month: 1 },
      end: { year: 2012, month: 6 },
      description: 'Order and catalogue services for an online shop.',
      responsibilities: [
        'Developed order APIs in Python for 300 merchants',
        'Maintained the PostgreSQL schema for the catalogue across a team of 12',
      ],
      skills: ['Python', 'PostgreSQL'],
    },
  ],
  education: [{ id: 'e_tu', institution: 'TU Example', degree: 'BSc Computer Science' }],
  certifications: [{ id: 'c_cka', name: 'Certified Kubernetes Administrator', issuer: 'CNCF' }],
  projects: [],
};

/** What a good generator writes from FACTS: every claim cites what it rests on. */
export const GOOD: CanonicalResume = {
  headline: 'Senior Backend Engineer',
  summary: { id: 's', text: 'Backend engineer, 10 years in software and 6 years of Go, working on payment systems and e-commerce.', evidence: ['profile#summary', 'r_pay', 'r_shop'], origin: 'generated' },
  skills: [
    { id: 'k1', name: 'Go', text: 'Go', evidence: ['r_pay'], origin: 'generated' },
    { id: 'k2', name: 'PostgreSQL', text: 'PostgreSQL', evidence: ['r_pay'], origin: 'generated' },
    { id: 'k3', name: 'Kubernetes', text: 'Kubernetes', evidence: ['r_pay'], origin: 'generated' },
  ],
  roles: [
    {
      roleId: 'r_pay',
      company: 'Lumen Pay',
      title: 'Senior Backend Engineer',
      start: { year: 2020, month: 3 },
      end: null,
      bullets: [
        { id: 'b1', text: 'Built the Go settlement service handling 2M transactions a day', evidence: ['r_pay#r0'], origin: 'generated' },
        { id: 'b2', text: 'Cut ledger API p99 latency by 45% (800 ms to 440 ms) by reworking PostgreSQL indexes', evidence: ['r_pay#r1'], origin: 'generated' },
        { id: 'b3', text: 'Migrated 40 services to Kubernetes with zero downtime', evidence: ['r_pay#r2'], origin: 'generated' },
      ],
    },
    {
      roleId: 'r_shop',
      company: 'Cartwheel',
      title: 'Backend Developer',
      start: { year: 2009, month: 1 },
      end: { year: 2012, month: 6 },
      bullets: [
        { id: 'b4', text: 'Built order APIs in Python serving 300 merchants', evidence: ['r_shop#r0'], origin: 'generated' },
        { id: 'b5', text: 'Maintained the PostgreSQL catalogue schema with a team of 12', evidence: ['r_shop#r1'], origin: 'generated' },
      ],
    },
  ],
  education: [{ factId: 'e_tu', institution: 'TU Example', degree: 'BSc Computer Science' }],
  certifications: [{ factId: 'c_cka', name: 'Certified Kubernetes Administrator' }],
  projects: [],
};
