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
import { seedIdentities } from '../seed/identities';
import { seedPersona } from '../seed/personas';
import { seedReference } from '../seed/reference';
import { seedContent } from '../seed/content';
import { importKbForReview } from '../services/skillsExplorer';
import { generateVolume, removeVolume } from '../seed/volume';

/**
 * `pnpm seed` — reference data, the role accounts and the two demo personas (P2-08).
 * `pnpm seed -- --volume 5000` — also adds synthetic volume users for EXPLAIN and load work.
 * `pnpm seed -- --remove-volume` — deletes the volume users again.
 * Local and test only: seeding writes demo data and the volume path uses the superuser.
 */
const config = loadConfig();
if (!['local', 'test'].includes(config.APP_ENV)) {
  console.error(`seed: refused in ${config.APP_ENV}. Seeding is for local and test databases only.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const volumeArg = args.indexOf('--volume');
const volume = volumeArg >= 0 ? Number(args[volumeArg + 1] ?? 5000) : 0;

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
    for (const line of await seedIdentities(config.DATABASE_URL)) console.log(`seed: ${line}`);
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
