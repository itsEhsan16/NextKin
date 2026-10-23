import { describe, expect, it } from 'vitest';

import { degradedMessages, serviceStatusSchema } from '../src/queries/useServiceStatus';

// The banner's data (P13-02): what /health/features returns, and the lines both apps show.
describe('service status', () => {
  const body = {
    status: 'degraded',
    capabilities: [
      { capability: 'ai', degraded: true, since: '2026-10-16T10:00:00.000Z', message: 'AI features are slow or paused.' },
      { capability: 'jobs', degraded: false },
      { capability: 'payments', degraded: true, message: 'Upgrades are paused.' },
      { capability: 'email', degraded: true },
    ],
  };

  it('parses the endpoint body and lists one line per degraded capability with a message', () => {
    const status = serviceStatusSchema.parse(body);
    expect(degradedMessages(status)).toEqual(['AI features are slow or paused.', 'Upgrades are paused.']);
  });

  it('shows nothing when all is well or when there is no status yet', () => {
    expect(degradedMessages(serviceStatusSchema.parse({ status: 'ok', capabilities: [{ capability: 'ai', degraded: false }] }))).toEqual([]);
    expect(degradedMessages(undefined)).toEqual([]);
  });

  it('refuses a body that is not the endpoint’s shape', () => {
    expect(() => serviceStatusSchema.parse({ status: 'fine', capabilities: [] })).toThrow();
  });
});
