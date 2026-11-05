import { describe, expect, it } from 'vitest';

import { generationLimit, rowStatus } from '../src/services/admin/people';
import { deviceOf } from '../src/services/admin/peopleDetail';

/** The People area's pure rules (toreview §171.13). */
describe('the admin People rules', () => {
  it('labels an account by its most pressing state', () => {
    expect(rowStatus({ status: 'suspended', email_verified: true }, true)).toBe('suspended');
    expect(rowStatus({ status: 'deleted', email_verified: true }, false)).toBe('deletion_pending');
    expect(rowStatus({ status: 'active', email_verified: false }, true)).toBe('comped');
    expect(rowStatus({ status: 'active', email_verified: false }, false)).toBe('unverified');
    expect(rowStatus({ status: 'active', email_verified: true }, false)).toBe('active');
  });

  it('reads the generation allowance as the plan merges it, unlimited drawn at fair use', () => {
    expect(generationLimit('free', {})).toBe(3);
    expect(generationLimit('free', { generation: 5 })).toBe(5);
    expect(generationLimit('pro', null)).toBe(100);
    expect(generationLimit('pro', { generation: null })).toBe(100);
    expect(generationLimit('pro', { generation: 250 })).toBe(250);
  });

  it('names a device from its user agent, or leaves it unknown', () => {
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Chrome on macOS');
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox on Windows');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge on Windows');
    expect(deviceOf(null)).toBeNull();
    expect(deviceOf('curl/8.4')).toBeNull();
  });
});
