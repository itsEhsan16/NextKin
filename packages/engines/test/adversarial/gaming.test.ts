/**
 * The adversarial suite, part 1: gaming (P8-09, old Q-08; G16). Every case starts from an honest
 * document and applies a trick. A trick wins if the total rises. The gate is zero wins.
 */
import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '../../src/document';
import { score, type ScoreInput } from '../../src/rubric';
import { approvedKb, backendInput, BACKEND_JD_TEXT, BACKEND_RESUME, NURSE_RESUME } from '../fixtures/documents';

const upload = (document: ScoringDocument): Partial<ScoreInput> => ({ document, profile: undefined });
const totalOf = (overrides: Partial<ScoreInput>) => score(backendInput(overrides)).totalBps!;

/**
 * A lean honest resume with room to game. Kafka and gRPC are what the profile does not back; Terraform
 * and Redis it does, so listing those is honest credit, not a trick.
 */
const LEAN: ScoringDocument = {
  ...BACKEND_RESUME,
  skills: ['Go', 'PostgreSQL', 'Docker'],
  roles: BACKEND_RESUME.roles.map((r) => ({ ...r, skills: (r.skills ?? []).filter((s) => !['Terraform', 'Redis'].includes(s)) })),
};

const tricks: readonly [string, Partial<ScoreInput>, Partial<ScoreInput>][] = [
  [
    'keyword stuffing in the summary (generated, profile yardstick)',
    { document: LEAN },
    { document: { ...LEAN, summary: `${LEAN.summary} Kafka Kafka gRPC gRPC Kafka gRPC Kafka.` } },
  ],
  [
    'repeating backed skills thirty times',
    { document: LEAN },
    { document: { ...LEAN, skills: Array.from({ length: 30 }, () => LEAN.skills).flat() } },
  ],
  [
    'listing unbacked JD skills in the skills section (generated)',
    { document: LEAN },
    { document: { ...LEAN, skills: [...LEAN.skills, 'Kafka', 'gRPC'] } },
  ],
  [
    'pasting the JD’s requirement lines into a bullet (upload yardstick)',
    upload(LEAN),
    upload({ ...LEAN, roles: LEAN.roles.map((r, i) => (i === 0 ? { ...r, bullets: [...r.bullets, 'Experience with Kafka is required. Nice to have: Terraform, gRPC and Redis.'] } : r)) }),
  ],
  [
    'hidden text: an unread field full of JD keywords',
    upload(LEAN),
    upload({ ...LEAN, hiddenText: BACKEND_JD_TEXT } as ScoringDocument),
  ],
  [
    'claiming a technology on a role that predates it (approved KB)',
    { document: LEAN, kb: approvedKb() },
    {
      document: { ...LEAN, roles: LEAN.roles.map((r) => (r.id === 'role_shop' ? { ...r, end: { year: 2012, month: 1 }, start: { year: 2009, month: 1 }, skills: [...(r.skills ?? []), 'Kafka', 'Kubernetes'] } : r.id === 'role_pay' ? r : r)) },
      kb: approvedKb(),
    },
  ],
];

describe('gaming never pays (G16)', () => {
  it.each(tricks)('%s does not raise the total', (_name, honest, gamed) => {
    expect(totalOf(gamed)).toBeLessThanOrEqual(totalOf(honest));
  });

  it('zero gaming wins in total', () => {
    const wins = tricks.filter(([, honest, gamed]) => totalOf(gamed) > totalOf(honest)).map(([name]) => name);
    expect(wins).toEqual([]);
  });

  it('a nurse’s resume against a backend JD matches low', () => {
    const result = score(backendInput({ document: NURSE_RESUME, profile: NURSE_RESUME }));
    expect(result.jdMatch!.matchBps).toBe(0);
    expect(result.jdMatch!.requiredMet).toBe(0);
    expect(result.band === 'fair' || result.band === 'weak').toBe(true);
    expect(result.total!).toBeLessThan(60);
  });
});
