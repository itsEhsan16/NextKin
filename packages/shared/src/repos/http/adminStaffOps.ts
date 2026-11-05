import { z } from 'zod';

import type { AdminPeopleRepo } from '../adminPeopleRepo';
import type { HttpClient } from './client';

/**
 * Staff & roles over HTTP (toreview §171.13): `/admin/staff*`. A member's id is their user id, the
 * one the audit log names. An invite or a reset answers with a temporary password, shown once.
 */

const role = z.enum(['support', 'curator', 'admin', 'super_admin']);
export const staffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role,
  mfa: z.enum(['totp', 'none']),
  lastActiveAt: z.string().nullable(),
  status: z.enum(['active', 'invited', 'disabled']),
});
const inviteSchema = z.object({ member: staffMemberSchema, temporaryPassword: z.string(), emailed: z.boolean() });
const resetSchema = z.object({ temporaryPassword: z.string(), emailed: z.boolean() });

const member = (id: string) => `/admin/staff/${encodeURIComponent(id)}`;

export function createStaffOps(http: HttpClient): Pick<AdminPeopleRepo, 'listStaff' | 'setStaffRole' | 'inviteStaff' | 'resetStaff'> {
  return {
    listStaff: async () => z.object({ data: z.array(staffMemberSchema) }).parse(await http.request('/admin/staff')).data,
    setStaffRole: async (id, next) => {
      await http.request(`${member(id)}/role`, { method: 'PUT', body: { role: next } });
    },
    inviteStaff: async (input) => inviteSchema.parse(await http.request('/admin/staff', { method: 'POST', body: { name: input.name.trim(), email: input.email.trim(), role: input.role } })),
    resetStaff: async (id) => resetSchema.parse(await http.request(`${member(id)}/reset`, { method: 'POST' })),
  };
}

/** Staff names by user id (any staff role), so audit rows can say who acted. */
export async function fetchStaffNames(http: HttpClient): Promise<Record<string, string>> {
  return z.object({ data: z.record(z.string(), z.string()) }).parse(await http.request('/admin/staff/names')).data;
}
