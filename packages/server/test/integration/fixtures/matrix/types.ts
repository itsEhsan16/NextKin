import type { Permission } from '../../../../src/services/admin/permissions';

export type Access = 'public' | 'user' | 'admin';

export interface MatrixEntry {
  access: Access;
  /** Admin routes (P12-01): the permission they need; its roles are the only ones allowed through. */
  permission?: Permission;
  /** A body that passes validation, so the probe reaches the access check. */
  body?: unknown;
  /** Headers the route requires before it gets as far as the access check. */
  headers?: Record<string, string>;
  /** A query string the route validates before the access check. */
  query?: Record<string, string>;
}
