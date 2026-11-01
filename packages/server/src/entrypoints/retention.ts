import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { RETENTION_TARGET, weekFourRetention } from '../services/admin/retention';

/**
 * `pnpm metrics:retention`: week-4 retention by signup week (V2 §2.2), read-only. The same numbers
 * as `GET /api/v1/admin/metrics/retention`, for use before the admin portal has a page for them.
 */

const config = loadConfig();
const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 2 });

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

try {
  const cohorts = await weekFourRetention(db);
  if (cohorts.length === 0) {
    console.log('Nobody has activated in the last 16 weeks, so there is nothing to measure yet.');
  } else {
    console.log(`Week-4 retention, target ${percent(RETENTION_TARGET)}`);
    console.log('Signup week   Activated   Returned   Rate');
    for (const c of cohorts) {
      const rate = c.rate === null ? '-' : percent(c.rate);
      console.log(`${c.week}    ${String(c.activated).padStart(9)}   ${String(c.returned).padStart(8)}   ${rate.padStart(4)}${c.complete ? '' : '  still counting'}`);
    }
  }
} finally {
  await db.destroy();
}
