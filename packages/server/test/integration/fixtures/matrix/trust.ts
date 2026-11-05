import type { MatrixEntry } from './types';

/** The authorization matrix's entries for the admin Trust routes (`authzMatrix.int.test.ts`). */
export const trustMatrix: Record<string, MatrixEntry> = {
  'GET /api/v1/admin/failures': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/failures/stats': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/failures/{id}': { access: 'admin', permission: 'users.read' },
  'POST /api/v1/admin/failures/retry': { access: 'admin', permission: 'users.manage', body: { ids: ['00000000-0000-7000-8000-000000000000'] } },
  'POST /api/v1/admin/failures/{id}/resolve': { access: 'admin', permission: 'users.manage' },
  'GET /api/v1/admin/reports': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/reports/stats': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/reports/{id}': { access: 'admin', permission: 'users.read' },
  'POST /api/v1/admin/reports/{id}/action': { access: 'admin', permission: 'users.manage', body: { action: 'dismiss', reason: 'matrix probe' } },
  'POST /api/v1/public/shared-reports/{token}/abuse-reports': { access: 'public' },
};
