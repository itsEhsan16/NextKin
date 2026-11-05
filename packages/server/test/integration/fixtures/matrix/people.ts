import type { MatrixEntry } from './types';

/** The authorization matrix's entries for the admin People routes (`authzMatrix.int.test.ts`). */
export const peopleMatrix: Record<string, MatrixEntry> = {
  'GET /api/v1/admin/people/stats': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/people/users': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/people/users/{id}': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/people/deletions': { access: 'admin', permission: 'users.read' },
  'POST /api/v1/admin/people/deletions/{id}/process': { access: 'admin', permission: 'users.manage', body: { reason: 'matrix probe' } },
};
