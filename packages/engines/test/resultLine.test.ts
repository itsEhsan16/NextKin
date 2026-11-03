import { describe, expect, it } from 'vitest';

import { isToolUseLine } from '../src/quantified';

/** Lines that say what was used, not what was done (toreview §159): the merge drops bolt-ons. */
describe('isToolUseLine', () => {
  it('an action line is not one', () => {
    expect(isToolUseLine('Built the onboarding flow for 40 merchants in Next.js')).toBe(false);
    expect(isToolUseLine('Automated the weekly sales report with n8n and Google Sheets')).toBe(false);
  });

  it('a line that only says what was used or known is', () => {
    expect(isToolUseLine('Used Git and pull requests across GitHub projects and hackathons')).toBe(true);
    expect(isToolUseLine('Applied Object-Oriented Programming alongside MySQL and MongoDB databases')).toBe(true);
    expect(isToolUseLine('Familiar with Docker, Kubernetes and the AWS console')).toBe(true);
  });
});
