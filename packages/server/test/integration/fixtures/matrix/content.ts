import type { MatrixEntry } from './types';

/**
 * The authorization matrix's entries for the admin Content routes (`authzMatrix.int.test.ts`). A
 * permitted probe really runs, so each write's body passes validation but is refused after the
 * permission check (an unknown category, template, version or suggestion): no probe changes data.
 */
export const contentMatrix: Record<string, MatrixEntry> = {
  'GET /api/v1/admin/skills/overview': { access: 'admin', permission: 'content.manage' },
  'GET /api/v1/admin/skills': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/skills': { access: 'admin', permission: 'content.manage', body: { name: 'Matrix probe', categoryId: 'no-such-category', aliases: [] } },
  'PUT /api/v1/admin/skills/{id}/aliases': { access: 'admin', permission: 'content.manage', body: { aliases: [] } },
  'POST /api/v1/admin/skills/{id}/terms': { access: 'admin', permission: 'content.manage', body: { term: 'probe' } },
  'POST /api/v1/admin/skills/merges/resolve': { access: 'admin', permission: 'content.manage', body: { id: 'merge:matrix probe', decision: 'dismiss' } },
  'POST /api/v1/admin/skill-categories': { access: 'admin', permission: 'content.manage', body: { name: '!!!' } },
  'POST /api/v1/admin/templates': { access: 'admin', permission: 'content.manage', body: { name: 'Matrix probe', basedOn: 'no-such-template' } },
  'GET /api/v1/admin/templates/usage': { access: 'admin', permission: 'content.manage' },
  'GET /api/v1/admin/rubric/rationale': { access: 'admin', permission: 'analytics.read' },
  'PUT /api/v1/admin/rubric/rationale': { access: 'admin', permission: 'content.manage', body: { version: 'v0-probe', paragraphs: ['Matrix probe.'] } },
  'GET /api/v1/admin/kb/stats': { access: 'admin', permission: 'content.manage' },
  'GET /api/v1/admin/prompts/figures': { access: 'admin', permission: 'content.manage' },
};
