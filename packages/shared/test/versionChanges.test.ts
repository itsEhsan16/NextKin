import { describe, expect, it } from 'vitest';

import type { ResumeContent } from '../src/models/resumeContent';
import { versionChanges } from '../src/scoring/versionChanges';

/** What a version changed, read off the two documents, and why (toreview §146.5). Synthetic. */

const ROLE = { id: 'r1', company: 'Acme', title: 'Designer', period: '2021 — 2024', bullets: ['Shipped checkout', 'Ran research'] };

const content = (over: Partial<ResumeContent>): ResumeContent => ({
  kind: 'resume',
  resumeId: 'res',
  versionId: 'v',
  summary: 'A designer.',
  skills: ['Figma'],
  experience: [ROLE],
  projects: [],
  certifications: [],
  education: [],
  ...over,
});

describe('versionChanges', () => {
  it('says nothing about what stayed the same', () => {
    expect(versionChanges({ before: content({}), after: content({}), actor: 'user' })).toEqual([]);
  });

  it('calls a line in the same place a rewording, for a hand edit', () => {
    const after = content({ experience: [{ ...ROLE, bullets: ['Rebuilt checkout', 'Ran research'] }] });
    expect(versionChanges({ before: content({}), after, actor: 'user' })).toEqual([
      {
        kind: 'reworded',
        where: 'Designer at Acme',
        text: 'Rebuilt checkout',
        before: 'Shipped checkout',
        why: 'You changed this.',
      },
    ]);
  });

  it('uses the version’s own citations for a rewording, whatever moved', () => {
    const after = content({ experience: [{ ...ROLE, bullets: ['Led research', 'Rebuilt checkout', 'New line'] }] });
    const rewordedFrom = new Map([
      ['Rebuilt checkout', 'Shipped checkout'],
      ['Led research', 'Ran research'],
    ]);
    const changes = versionChanges({ before: content({}), after, actor: 'generation', rewordedFrom });
    expect(changes.map((c) => [c.kind, c.text, c.before])).toEqual([
      ['reworded', 'Led research', 'Ran research'],
      ['reworded', 'Rebuilt checkout', 'Shipped checkout'],
      ['added', 'New line', undefined],
    ]);
    expect(changes[0]?.why).toBe('Reworded for this job, from your own line.');
  });

  it('says what was removed, and that the source resume still has it', () => {
    const after = content({ experience: [{ ...ROLE, bullets: ['Shipped checkout'] }] });
    expect(versionChanges({ before: content({}), after, actor: 'generation' })).toEqual([
      {
        kind: 'removed',
        where: 'Designer at Acme',
        text: 'Ran research',
        why: 'Left out of this version. The resume it was made from still has it.',
      },
    ]);
  });

  it('gives a skill the run added as the person’s own word', () => {
    const after = content({ skills: ['Figma', 'Kubernetes'] });
    expect(versionChanges({ before: content({}), after, actor: 'generation' })[0]).toEqual({
      kind: 'added',
      where: 'Skills',
      text: 'Kubernetes',
      why: 'You said you have this.',
    });
  });

  it('lists what the check took out of the draft, in plain words', () => {
    const changes = versionChanges({
      before: content({}),
      after: content({}),
      actor: 'generation',
      dropped: [
        { text: 'Grew revenue by 40%', reason: 'number_not_in_facts' },
        { text: 'Led the migration', reason: 'something_new' },
      ],
    });
    expect(changes.map((c) => [c.kind, c.where, c.why])).toEqual([
      ['removed', 'The AI’s draft', 'This states a number you never gave.'],
      ['removed', 'The AI’s draft', 'Our check took this out.'],
    ]);
  });

  it('has nothing to compare on a first version, but still lists what the check took out', () => {
    const dropped = [{ text: 'Grew revenue by 40%', reason: 'number_not_in_facts' }];
    expect(versionChanges({ before: undefined, after: content({}), actor: 'generation' })).toEqual([]);
    expect(versionChanges({ before: undefined, after: content({}), actor: 'generation', dropped })).toHaveLength(1);
  });

  it('covers a role that has gone, whole', () => {
    const changes = versionChanges({ before: content({}), after: content({ experience: [] }), actor: 'user' });
    expect(changes.map((c) => [c.kind, c.where, c.text])).toEqual([
      ['removed', 'Designer at Acme', 'Shipped checkout'],
      ['removed', 'Designer at Acme', 'Ran research'],
    ]);
  });
});
