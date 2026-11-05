import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import type { StaffLevel } from '../services/admin/permissions';
import { bootstrapStaff, STAFF_LEVELS } from '../services/admin/staff';

/**
 * Creates a staff account from the command line (toreview §171.13): the way an environment gets its
 * first Super Admin, before anyone can sign in to invite others.
 *
 *   pnpm --filter @nextkin/server staff:create --email you@company.com --name "Your Name" [--role super_admin]
 *
 * Prints a temporary password once. The first sign-in at /admin/sign-in sets up an authenticator
 * and replaces it with a password of the member's own.
 */
const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const email = value('--email');
const name = value('--name') ?? email?.split('@')[0];
const role = (value('--role') ?? 'super_admin') as StaffLevel;
if (!email || !name || !STAFF_LEVELS.includes(role)) {
  console.error('usage: staff:create --email you@company.com --name "Your Name" [--role support|curator|admin|super_admin]');
  process.exit(1);
}

const config = loadConfig();
const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL });
try {
  const created = await bootstrapStaff(db, { email, name, role });
  console.log(`staff:create: ${created.email} (${role})`);
  console.log(`staff:create: temporary password, shown once: ${created.temporaryPassword}`);
  console.log('staff:create: sign in at /admin/sign-in; you will set up an authenticator and choose your own password.');
} catch (error) {
  console.error(`staff:create: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
