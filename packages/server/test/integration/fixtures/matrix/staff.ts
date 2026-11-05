import type { MatrixEntry } from './types';

/** The authorization matrix's entries for staff sign-in, Staff & roles and Settings (toreview §171.13). */
export const staffMatrix: Record<string, MatrixEntry> = {
  'POST /api/v1/auth/admin/enroll': { access: 'public' },
  'POST /api/v1/auth/admin/password': { access: 'public' },
  'POST /api/v1/auth/admin/reauth': { access: 'admin', permission: 'analytics.read', body: { code: '123456' } },
  'GET /api/v1/admin/staff': { access: 'admin', permission: 'roles.assign' },
  'POST /api/v1/admin/staff': { access: 'admin', permission: 'roles.assign', body: { name: 'Matrix Probe', email: 'matrix-invite@authflow.test', role: 'support' } },
  'POST /api/v1/admin/staff/{id}/reset': { access: 'admin', permission: 'roles.assign' },
  'PUT /api/v1/admin/staff/{id}/role': { access: 'admin', permission: 'roles.assign', body: { role: 'support' } },
  'GET /api/v1/admin/staff/names': { access: 'admin', permission: 'analytics.read' },
  'GET /api/v1/admin/settings': { access: 'admin', permission: 'analytics.read' },
  'PATCH /api/v1/admin/settings': { access: 'admin', permission: 'roles.assign', body: {} },
  'POST /api/v1/admin/settings/backup-codes': { access: 'admin', permission: 'analytics.read' },
  'POST /api/v1/admin/settings/authenticator': { access: 'admin', permission: 'analytics.read' },
  'POST /api/v1/admin/settings/authenticator/confirm': { access: 'admin', permission: 'analytics.read', body: { challenge: 'matrix-probe-challenge-0000', code: '123456' } },
};
