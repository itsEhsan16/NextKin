/**
 * The adversarial suite, part 3: mutation (P8-09). Fabrications are seeded into a known-good
 * generated resume, and the engines must catch each one by something other than the code that
 * made it. The catch rate is printed with every run.
 *
 * P8 covers the fabrication classes its engines judge: a technology a role's dates rule out, a skill
 * the profile does not back, and text copied from the JD. P9's claim ledger adds employers, titles,
 * dates and numbers, and owns the ≥ 99% bar across all of them (P9-04).
 */
import { describe, expect, it } from 'vitest';

import { KB } from '../../src/datasets/kb';
import { TAXONOMY } from '../../src/datasets/taxonomy';
import type { ScoringDocument } from '../../src/document';
import { skillById } from '../../src/normalizer';
import { score } from '../../src/rubric';
import { approvedKb, backendInput, BACKEND_JD_TEXT, BACKEND_PROFILE, BACKEND_RESUME } from '../fixtures/documents';

/** The older role, moved to end in 2012 so later technologies are ruled out. */
const BASE: ScoringDocument = {
  ...BACKEND_RESUME,
  roles: BACKEND_RESUME.roles.map((r) =>
    r.id === 'role_shop'
      ? {
          ...r,
          start: { year: 2009, month: 1 },
          end: { year: 2012, month: 6 },
          skills: ['Python', 'PostgreSQL'],
          bullets: ['Developed order APIs in Python for 300 merchants', 'Maintained the PostgreSQL schema for the catalogue'],
        }
      : r,
  ),
};
const PROFILE: ScoringDocument = { ...BACKEND_PROFILE, roles: BASE.roles };
const KB_APPROVED = approvedKb();
const TEMPLATES = ['Built internal tooling with {x}', 'Migrated the reporting stack to {x}', 'Introduced {x} across the team', 'Used {x} for the order pipeline'];

interface Mutation {
  kind: string;
  label: string;
  doc: ScoringDocument;
  caught: (r: ReturnType<typeof score>) => boolean;
}

const backedIds = new Set(['go', 'postgresql', 'docker', 'kubernetes', 'redis', 'python', 'terraform']);
const later = KB.entries.filter((e) => e.releaseYear > 2012).map((e) => e.skillId);
const unbacked = KB.entries.map((e) => e.skillId).filter((id) => !backedIds.has(id));

const mutations: Mutation[] = [
  ...later.flatMap((id, i) => {
    const name = skillById(TAXONOMY, id)!.name;
    const bullet = TEMPLATES[i % TEMPLATES.length]!.replace('{x}', name);
    return [
      {
        kind: 'era-invalid technology in a bullet',
        label: bullet,
        doc: { ...BASE, roles: BASE.roles.map((r) => (r.id === 'role_shop' ? { ...r, bullets: [...r.bullets, bullet] } : r)) },
        caught: (r: ReturnType<typeof score>) => r.timeline.pairs.some((p) => p.roleId === 'role_shop' && p.skillId === id && p.hardFail),
      },
      {
        kind: 'era-invalid technology as a role tag',
        label: name,
        doc: { ...BASE, roles: BASE.roles.map((r) => (r.id === 'role_shop' ? { ...r, skills: [...(r.skills ?? []), name] } : r)) },
        caught: (r: ReturnType<typeof score>) => r.timeline.pairs.some((p) => p.roleId === 'role_shop' && p.skillId === id && p.hardFail),
      },
    ];
  }),
  ...unbacked.flatMap((id, i) => {
    const name = skillById(TAXONOMY, id)!.name;
    const bullet = TEMPLATES[i % TEMPLATES.length]!.replace('{x}', name);
    return [
      {
        kind: 'unbacked skill in the skills section',
        label: name,
        doc: { ...BASE, skills: [...BASE.skills, name] },
        caught: (r: ReturnType<typeof score>) => r.unbackedClaims.some((c) => c.skillId === id),
      },
      {
        kind: 'unbacked skill in a bullet',
        label: bullet,
        doc: { ...BASE, roles: BASE.roles.map((r) => (r.id === 'role_pay' ? { ...r, bullets: [...r.bullets, bullet] } : r)) },
        caught: (r: ReturnType<typeof score>) => r.unbackedClaims.some((c) => c.skillId === id),
      },
    ];
  }),
  {
    kind: 'JD text pasted into a bullet',
    label: 'JD line 2',
    doc: { ...BASE, roles: BASE.roles.map((r) => (r.id === 'role_pay' ? { ...r, bullets: [...r.bullets, BACKEND_JD_TEXT.split('\n')[1]!] } : r)) },
    caught: (r) => r.copiedFromJd.length > 0,
  },
];

describe('seeded fabrications', () => {
  it('are caught, and the catch rate is reported', () => {
    const missed: string[] = [];
    const byKind = new Map<string, { seeded: number; caught: number }>();
    for (const m of mutations) {
      const result = score(backendInput({ document: m.doc, profile: PROFILE, kb: KB_APPROVED }));
      const caught = m.caught(result);
      const tally = byKind.get(m.kind) ?? { seeded: 0, caught: 0 };
      tally.seeded += 1;
      if (caught) tally.caught += 1;
      else missed.push(`${m.kind}: ${m.label}`);
      byKind.set(m.kind, tally);
    }
    const seeded = mutations.length;
    const caught = seeded - missed.length;
    const lines = [...byKind].map(([kind, t]) => `  ${kind}: ${t.caught}/${t.seeded}`);
    console.log(`Mutation catch rate: ${caught}/${seeded} (${((caught / seeded) * 100).toFixed(1)}%)\n${lines.join('\n')}${missed.length ? `\nMissed:\n  ${missed.join('\n  ')}` : ''}`);
    expect(caught / seeded).toBeGreaterThanOrEqual(0.99);
  });

  it('the known-good resume itself raises no flag', () => {
    const clean = score(backendInput({ document: BASE, profile: PROFILE, kb: KB_APPROVED }));
    expect(clean.unbackedClaims).toEqual([]);
    expect(clean.timeline.unresolvedHardFails).toBe(0);
    expect(clean.copiedFromJd).toEqual([]);
  });
});
