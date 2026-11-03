import { describe, expect, it } from 'vitest';

import { canCarryResult } from '../src/quantified';

/** Which lines may be asked for a measured result (toreview §159). */
describe('canCarryResult', () => {
  it('an action line can carry a result', () => {
    expect(canCarryResult('Built the onboarding flow for 40 merchants in Next.js')).toBe(true);
    expect(canCarryResult('Automated the weekly sales report with n8n and Google Sheets')).toBe(true);
  });

  it('a line that only says what was used or known cannot', () => {
    expect(canCarryResult('Used Git and pull requests across GitHub projects and hackathons')).toBe(false);
    expect(canCarryResult('Applied Object-Oriented Programming alongside MySQL and MongoDB databases')).toBe(false);
    expect(canCarryResult('Familiar with Docker, Kubernetes and the AWS console')).toBe(false);
  });

  it('a fragment too short to say what was done cannot', () => {
    expect(canCarryResult('Built dashboards')).toBe(false);
  });
});
