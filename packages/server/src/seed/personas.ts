import type { ActivityEntry, DocumentContent, InterviewSet, Job, Profile, Resume, ResumeVersion, Subscription, User } from '@nextkin/shared/models';
import { canonicalFromContent, canonicalLetterFromContent } from '@nextkin/shared/scoring/fromContent';
import { canonicalLetterSchema, canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { sql } from 'kysely';
import type { Database, Tx } from '../db/database';
import { sha256, stableId } from './ids';
import { FIXTURE_CATALOGUE } from '../jobs/fixtures/catalogue';
import { fixtureHashOf, jobIdOf } from '../jobs/ids';
import { normalizeFixture } from '../jobs/providers/fixture';

/**
 * Seeds the two demo personas from the shared mock fixtures (ImBackendImplementationPlan P2-08):
 * mobile's George and the web app's own persona (`configureMockPlatform('web')`). Their example
 * records are design (board fidelity), so a screen looks the same on the backend as on the mock
 * once its repository flips to HTTP. Computed numbers (scores, match %, completeness) are not
 * copied: the engines produce those, and C-11 flags any board number they do not.
 *
 * Everything is written through withUser, so seeding also exercises the RLS write path. Re-running
 * replaces a persona: the user row is deleted (cascading) and recreated.
 */

export interface PersonaFixtures {
  key: string;
  user: User;
  profile: Profile;
  subscription: Subscription;
  resumes: Resume[];
  versions: ResumeVersion[];
  contents: Record<string, DocumentContent>;
  jobs: Job[];
  activity: ActivityEntry[];
  /** Practice sets (P11-08), marks included: the interview list's example records. */
  interviewSets: InterviewSet[];
}

const dateOnly = (iso: string) => iso.slice(0, 10);
const URL_OK = /^https?:\/\//;

async function seedProfile(tx: Tx, userId: string, p: Profile): Promise<void> {
  await tx
    .insertInto('profiles')
    .values({
      user_id: userId,
      headline: p.headline ?? null,
      location: p.location ?? null,
      years_experience: p.yearsExperience ?? null,
      phone: p.phone ?? null,
      bio: p.bio ?? null,
      tagline: p.tagline ?? null,
      preferences: JSON.stringify(p.preferences ?? {}),
    })
    .execute();

  for (const [order, e] of p.experiences.entries()) {
    const experienceId = stableId(`experience:${userId}:${e.id}`);
    await tx
      .insertInto('experience')
      .values({
        id: experienceId,
        user_id: userId,
        company: e.company,
        title: e.title,
        start_date: dateOnly(e.startDate),
        end_date: e.current || !e.endDate ? null : dateOnly(e.endDate),
        end_precision: e.current || !e.endDate ? null : 'day',
        start_precision: 'day',
        is_current: e.current,
        description: e.summary ?? null,
        sort_order: order,
      })
      .execute();
    for (const skill of new Set(e.skills)) {
      await tx.insertInto('experience_skills').values({ experience_id: experienceId, user_id: userId, raw_name: skill }).execute();
    }
  }

  for (const [order, ed] of p.education.entries()) {
    await tx
      .insertInto('education')
      .values({
        id: stableId(`education:${userId}:${ed.id}`),
        user_id: userId,
        institution: ed.institution,
        degree: ed.degree,
        field: ed.field ?? null,
        start_date: ed.startDate ? dateOnly(ed.startDate) : null,
        start_precision: ed.startDate ? 'day' : null,
        end_date: ed.current || !ed.endDate ? null : dateOnly(ed.endDate),
        end_precision: ed.current || !ed.endDate ? null : 'day',
        is_current: ed.current,
        sort_order: order,
      })
      .execute();
  }

  for (const c of p.certifications) {
    await tx
      .insertInto('certifications')
      .values({
        id: stableId(`certification:${userId}:${c.id}`),
        user_id: userId,
        name: c.name,
        issuer: c.issuer,
        issued_on: c.issuedOn ? dateOnly(c.issuedOn) : null,
        expires_on: c.expiresOn ? dateOnly(c.expiresOn) : null,
        credential_url: c.credentialUrl && URL_OK.test(c.credentialUrl) ? c.credentialUrl : null,
      })
      .execute();
  }

  for (const [order, l] of p.links.entries()) {
    if (!URL_OK.test(l.url)) continue;
    await tx
      .insertInto('profile_links')
      .values({ id: stableId(`link:${userId}:${l.id}`), user_id: userId, label: l.label, url: l.url, kind: l.kind ?? null, sort_order: order })
      .execute();
  }

  for (const [order, skill] of [...new Set(p.skills)].entries()) {
    await tx.insertInto('profile_skills').values({ user_id: userId, raw_name: skill, sort_order: order }).execute();
  }
}

/**
 * A fixture body as `resume_versions.content` stores it: canonical JSON, the shape every server
 * reader parses (toreview §109). The fixtures are written as editor content, so each line is the
 * user's own; validated here so a fixture that cannot be stored fails the seed, not a page.
 */
const storedBody = (content: DocumentContent) =>
  content.kind === 'resume' ? canonicalResumeSchema.parse(canonicalFromContent(content)) : canonicalLetterSchema.parse(canonicalLetterFromContent(content));

async function seedResumes(tx: Tx, userId: string, f: PersonaFixtures): Promise<void> {
  for (const r of f.resumes) {
    const resumeId = stableId(`resume:${f.key}:${r.id}`);
    await tx
      .insertInto('resumes')
      .values({
        id: resumeId,
        user_id: userId,
        title: r.title,
        doc_type: r.docType,
        source: r.needsReview ? 'zero_resume' : 'manual',
        is_base: r.isBase ?? false,
        target_company: r.targetCompany ?? null,
        target_role: r.targetRole ?? null,
        tags: r.tags,
        archived_at: r.archived ? r.updatedAt : null,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })
      .execute();

    const content = f.contents[r.id];
    if (!content) continue; // a shell still generating has no content yet
    const versions = f.versions.filter((v) => v.resumeId === r.id).sort((x, y) => x.version - y.version);
    let currentVersionId: string | undefined;
    for (const v of versions) {
      currentVersionId = stableId(`version:${f.key}:${v.id}`);
      const body = JSON.stringify(storedBody(content));
      await tx
        .insertInto('resume_versions')
        .values({
          id: currentVersionId,
          resume_id: resumeId,
          user_id: userId,
          version_number: v.version,
          content: body,
          content_hash: sha256(`${v.id}:${body}`),
          change_note: v.changeNote?.slice(0, 300) ?? null,
          created_by: v.version === 1 ? 'generation' : 'user',
          created_at: v.createdAt,
        })
        .execute();
    }
    if (currentVersionId) {
      await tx.updateTable('resumes').set({ current_version_id: currentVersionId }).where('id', '=', resumeId).execute();
    }
  }
}

/**
 * Saved listings as the server keeps them (P11-04): the normalized listing from the fixture
 * catalogue. A job imported from a link is the app's own record (D-17: link import stays on the
 * mock), so it is not seeded here, or the app would show it twice.
 */
async function seedSavedJobs(tx: Tx, userId: string, jobs: Job[]): Promise<void> {
  const now = Date.now();
  for (const job of jobs.filter((j) => j.isSaved && !j.sourceUrl)) {
    const index = FIXTURE_CATALOGUE.findIndex((listing) => listing.id === job.id);
    if (index < 0) continue;
    const listing = normalizeFixture(FIXTURE_CATALOGUE[index]!, index, now);
    await tx
      .insertInto('saved_jobs')
      .values({
        user_id: userId,
        apply_url_hash: listing.applyUrlHash,
        snapshot: JSON.stringify(listing),
        saved_at: job.savedAt ?? sql<Date>`now()`,
      })
      .execute();
  }
}

/** A fixture job's id as the server carries it (`job_stripe` → its derived UUID). */
const serverJobId = (fixtureId: string) => jobIdOf(fixtureHashOf(fixtureId));
/** A fixture deep link as the server serves it: listings and practice sets under their server ids. */
const serverLink = (key: string, link: string | undefined) =>
  link
    ?.replace(/\/jobs\/(job_[a-z0-9_]+)/gi, (_m, id: string) => `/jobs/${serverJobId(id)}`)
    .replace(/\/interview\/(int_[a-z0-9_]+)/gi, (_m, id: string) => `/interview/${stableId(`interview:${key}:${id}`)}`);

async function seedInterviewSets(tx: Tx, userId: string, f: PersonaFixtures): Promise<void> {
  for (const set of f.interviewSets) {
    await tx
      .insertInto('interview_question_sets')
      .values({
        id: stableId(`interview:${f.key}:${set.id}`),
        user_id: userId,
        resume_id: set.resumeId ? stableId(`resume:${f.key}:${set.resumeId}`) : null,
        job_id: set.jobId && /^job_/.test(set.jobId) ? serverJobId(set.jobId) : null,
        title: set.title,
        is_generic: set.source === 'standalone',
        company: set.company ?? null,
        role_title: set.roleTitle ?? null,
        questions: JSON.stringify(set.questions),
        created_at: set.createdAt,
      })
      .execute();
  }
}

export async function seedPersona(db: Database, f: PersonaFixtures): Promise<string> {
  const userId = stableId(`user:${f.key}`);
  // Replace an earlier run: the cascade removes everything the persona owned.
  await db.withSystem(`seed: replace persona ${f.key}`, (tx) => tx.deleteFrom('users').where('id', '=', userId).execute());

  await db.withUser({ userId, role: 'user' }, async (tx) => {
    await tx
      .insertInto('users')
      .values({
        id: userId,
        identity_sub: `local|persona:${f.key}`,
        email: f.user.email,
        email_verified: f.user.emailVerified ?? true,
        first_name: f.user.firstName,
        last_name: f.user.lastName,
        created_at: f.user.createdAt,
      })
      .execute();
    await tx.insertInto('user_settings').values({ user_id: userId }).execute();
    await seedProfile(tx, userId, f.profile);
    await seedResumes(tx, userId, f);
    await seedSavedJobs(tx, userId, f.jobs);
    await seedInterviewSets(tx, userId, f);

    for (const a of f.activity) {
      await tx
        .insertInto('activity')
        .values({
          id: stableId(`activity:${f.key}:${a.id}`),
          user_id: userId,
          kind: a.kind,
          title: a.title,
          detail: a.detail ?? null,
          deep_link: serverLink(f.key, a.deepLink) ?? null,
          resume_id: a.resumeId ? stableId(`resume:${f.key}:${a.resumeId}`) : null,
          job_ref: a.jobId ? (/^job_/.test(a.jobId) ? serverJobId(a.jobId) : a.jobId) : null,
          created_at: a.createdAt,
        })
        .execute();
    }

    const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
    await tx
      .insertInto('subscriptions')
      .values({
        billing_account_id: account.id,
        user_id: userId,
        plan_id: f.subscription.plan === 'pro' ? 'pro_monthly' : 'free',
        status: f.subscription.status,
        current_period_end: f.subscription.renewsAt ?? null,
      })
      .execute();
    await tx.insertInto('consents').values({ user_id: userId, kind: 'ai_processing', document_version: 'providers-v1' }).execute();
  });
  return userId;
}
