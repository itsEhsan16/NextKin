import type { MatrixEntry } from './types';

/** The authorization matrix's entries for the admin Business routes (`authzMatrix.int.test.ts`). */
// The seeded Pro prices: an allowed probe gets 409 (nothing to change), so the probe writes nothing.
const PRICES = { USD: 1900, EUR: 1900, AUD: 2900 };

export const businessMatrix: Record<string, MatrixEntry> = {
  'GET /api/v1/admin/overview': { access: 'admin', permission: 'analytics.read' },
  'GET /api/v1/admin/analytics/report': { access: 'admin', permission: 'analytics.read' },
  'GET /api/v1/admin/price-book': { access: 'admin', permission: 'plans.manage' },
  'POST /api/v1/admin/price-book': { access: 'admin', permission: 'plans.manage', body: { monthly: PRICES, annual: { USD: 10900, EUR: 10900, AUD: 16500 } } },
  'GET /api/v1/admin/plans/stats': { access: 'admin', permission: 'plans.manage' },
  'GET /api/v1/admin/comps': { access: 'admin', permission: 'plans.manage' },
  'POST /api/v1/admin/comps/{id}/end': { access: 'admin', permission: 'users.manage' },
  'GET /api/v1/admin/providers/stats': { access: 'admin', permission: 'providers.manage' },
};
