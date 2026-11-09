import { describe, expect, it } from 'vitest';

import { scoreTargetsOf } from '../src/pipeline/stages/resume';

/** Where each backed requirement earns full credit (§202, D-14): the roles whose facts back it. */
describe('scoreTargetsOf', () => {
  it('names the roles that may show each backed requirement, and leaves out one no role backs', () => {
    const plan = {
      backed: ['PostgreSQL', 'React', 'Kafka'],
      gaps: ['Kubernetes'],
      roles: [
        { roleId: 'now', allowedSkills: ['postgres', 'Go'], emphasis: [] },
        { roleId: 'before', allowedSkills: ['React', 'PostgreSQL'], emphasis: [] },
      ],
    };
    expect(scoreTargetsOf(plan)).toEqual([
      { skill: 'PostgreSQL', roles: ['now', 'before'] },
      { skill: 'React', roles: ['before'] },
    ]);
  });
});
