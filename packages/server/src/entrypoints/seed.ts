import { activityFixture } from '@nextkin/shared/mock/fixtures/activity';
import { webProfileFixture, webUserFixture } from '@nextkin/shared/mock/fixtures/account.web';
import { contentsFixture } from '@nextkin/shared/mock/fixtures/contents';
import { interviewSetsFixture } from '@nextkin/shared/mock/fixtures/interview';
import { jobsFixture } from '@nextkin/shared/mock/fixtures/jobs';
import { webJobsFixture } from '@nextkin/shared/mock/fixtures/jobs.web';
import { profileFixture } from '@nextkin/shared/mock/fixtures/profile';
import { resumesFixture, resumeVersionsFixture } from '@nextkin/shared/mock/fixtures/resumes';
import { webContentsFixture, webResumesFixture, webResumeVersionsFixture } from '@nextkin/shared/mock/fixtures/resumes.web';
import { subscriptionFixture, userFixture } from '@nextkin/shared/mock/fixtures/user';
import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { seedAccounts } from '../seed/accounts';
import { SEED_PASSWORD, seedIdentities } from '../seed/identities';
import { seedStaff } from '../seed/staff';
import { seedPersona } from '../seed/personas';
import { seedReference } from '../seed/reference';
import { seedContent } from '../seed/content';
import { importKbForReview } from '../services/skillsExplorer';
import { generateVolume, removeVolume } from '../seed/volume';

/**
 * `pnpm seed` — reference data, the role accounts and the two demo personas (P2-08).
 * `pnpm seed -- --volume 5000` — also adds synthetic volume users for EXPLAIN and load work.
 * `pnpm seed -- --remove-volume` — deletes the volume users again.
 * Local and test, plus a shared `dev` (the AWS demo, toreview §133) when SEED_PASSWORD and
 * SEED_TOTP_SECRET are set, so its accounts never carry the repo's published credentials. The
 * volume paths use the superuser and stay local and test only.
 */
const config = loadConfig();
const sharedDev = config.APP_ENV === 'dev';
if (!['local', 'test', 'dev'].includes(config.APP_ENV)) {
  console.error(`seed: refused in ${config.APP_ENV}. Seeding is for local, test and dev databases only.`);
  process.exit(1);
}
const devCredentials =
  config.SEED_PASSWORD && config.SEED_TOTP_SECRET
    ? { password: config.SEED_PASSWORD, totpSecret: config.SEED_TOTP_SECRET }
    : undefined;
if (sharedDev && !devCredentials) {
  console.error('seed: dev needs SEED_PASSWORD and SEED_TOTP_SECRET; the published ones are for laptops.');
  process.exit(1);
}

const args = process.argv.slice(2);
const volumeArg = args.indexOf('--volume');
const volume = volumeArg >= 0 ? Number(args[volumeArg + 1] ?? 5000) : 0;
if (sharedDev && (volume > 0 || args.includes('--remove-volume'))) {
  console.error('seed: volume users are local and test only.');
  process.exit(1);
}

if (args.includes('--remove-volume')) {
  if (!config.DATABASE_ADMIN_URL) throw new Error('DATABASE_ADMIN_URL is required to remove volume users.');
  console.log(`seed: removed ${await removeVolume(config.DATABASE_ADMIN_URL)} volume users`);
  process.exit(0);
}

const db = createDatabase({
  appUrl: config.DATABASE_URL,
  maintenanceUrl: config.DATABASE_MAINTENANCE_URL,
  onPrivilegedAccess: (e) => console.log(`seed: ${e.kind} access — ${e.purpose}`),
});

// Prompts, routing and the other reference rows only: a shared `dev` gets new prompt versions
// without its accounts being replaced (toreview §160).
if (args.includes('--reference-only')) {
  try {
    await seedReference(db);
    console.log('seed: reference data only (plans, prompts, routing, settings); accounts untouched');
  } finally {
    await db.destroy();
  }
  process.exit(0);
}

try {
  await seedReference(db);
  console.log('seed: reference data (plans, rubric v1, dataset versions, settings)');
  await seedContent(db);
  console.log('seed: support content v1 (FAQ, terms, privacy)');
  const kb = await importKbForReview(db);
  console.log(`seed: starter KB for curator review, unpublished (${kb.inserted} new entries, ${kb.related} links)`);
  const accounts = await seedAccounts(db);
  console.log(`seed: ${accounts.length} role accounts (free, pro, admin, curator, support @nextkin.test)`);

  // Mobile and web each seed their own persona in the mock (configureMockPlatform); both become
  // real users here. The web persona keeps the mobile persona's subscription and activity, which
  // is what the web mock shows too.
  await seedPersona(db, {
    key: 'mobile',
    user: userFixture,
    profile: profileFixture,
    subscription: subscriptionFixture,
    resumes: resumesFixture,
    versions: resumeVersionsFixture,
    contents: contentsFixture,
    jobs: jobsFixture,
    activity: activityFixture,
    interviewSets: interviewSetsFixture,
  });
  await seedPersona(db, {
    key: 'web',
    user: webUserFixture,
    profile: webProfileFixture,
    subscription: subscriptionFixture,
    resumes: webResumesFixture,
    versions: webResumeVersionsFixture,
    contents: webContentsFixture,
    jobs: webJobsFixture,
    activity: activityFixture,
    // The web app has no interview screens yet (coming soon), so its persona has no sets.
    interviewSets: [],
  });
  console.log(`seed: personas ${userFixture.email} (mobile) and ${webUserFixture.email} (web)`);

  if (config.IDENTITY_ADAPTER === 'local') {
    for (const line of await seedIdentities(config.DATABASE_URL, devCredentials)) console.log(`seed: ${line}`);
  }
  // Staff accounts are the server's own, under every identity adapter (toreview §171.13).
  const staffPassword = devCredentials?.password ?? SEED_PASSWORD;
  const staffCreated = await seedStaff(db, staffPassword);
  console.log(`seed: staff accounts admin@ (Super Admin), curator@, support@nextkin.test: ${staffCreated} new, others kept as they are`);
  if (staffCreated > 0 && !devCredentials) {
    console.log(`seed: a new staff account's first sign-in at /admin/sign-in uses the temporary password ${SEED_PASSWORD}, sets up an authenticator, then chooses a new password`);
  }

  if (volume > 0) {
    if (!config.DATABASE_ADMIN_URL) throw new Error('DATABASE_ADMIN_URL is required for --volume.');
    const started = Date.now();
    await generateVolume(config.DATABASE_ADMIN_URL, { users: volume });
    console.log(`seed: ${volume} volume users in ${Date.now() - started} ms`);
  }
} finally {
  await db.destroy();
}
