import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Database } from '../../../src/db/database';

/**
 * Creates one user with at least one row in every user-owned table, through the app role and
 * withUser — so building it also proves RLS lets a user write their own data. The RLS suite fails
 * if a user-owned table has no row here, which forces this builder to grow with the schema.
 */

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Global reference rows the graph points at, created once by an admin session. */
export async function ensureReferenceData(db: Database, adminId: string): Promise<{ rubricVersionId: string }> {
  return db.withUser({ userId: adminId, role: 'admin' }, async (tx) => {
    await tx
      .insertInto('plans')
      .values({ id: 'free', tier: 'free', name: 'NextKin Free', quotas: JSON.stringify({ generation: 3 }) })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
    const existing = await tx.selectFrom('rubric_versions').select('id').where('version', '=', 'test-1').executeTakeFirst();
    if (existing) return { rubricVersionId: existing.id };
    const row = await tx
      .insertInto('rubric_versions')
      .values({
        version: 'test-1',
        weights: JSON.stringify({ keywords: 4000, timeline: 2000, sections: 1500, formatting: 1500, achievements: 1000 }),
        bands: JSON.stringify({ strong: 8500, good: 7000, fair: 5500 }),
        rationale: 'Test rubric for the RLS suite.',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { rubricVersionId: row.id };
  });
}

export interface UserGraph {
  userId: string;
  ids: Record<string, string>;
}

export async function createUserGraph(db: Database, label: string, rubricVersionId: string): Promise<UserGraph> {
  const userId = randomUUID();
  const ids: Record<string, string> = {};
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    await tx
      .insertInto('users')
      .values({ id: userId, identity_sub: `test|${label}|${userId}`, email: `${label}-${userId}@example.test`, first_name: label })
      .execute();
    await tx.insertInto('user_settings').values({ user_id: userId }).execute();
    await tx.insertInto('profiles').values({ user_id: userId, headline: `${label} headline` }).execute();

    const exp = await tx
      .insertInto('experience')
      .values({ user_id: userId, company: 'Acme', title: 'Engineer', start_date: '2020-01-01', end_date: '2022-06-01', end_precision: 'month' })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.experience = exp.id;
    await tx.insertInto('experience_skills').values({ experience_id: exp.id, user_id: userId, raw_name: 'TypeScript' }).execute();
    await tx.insertInto('education').values({ user_id: userId, institution: 'Uni', degree: 'BSc' }).execute();
    await tx.insertInto('certifications').values({ user_id: userId, name: 'Cert', issuer: 'Issuer' }).execute();
    await tx.insertInto('projects').values({ user_id: userId, name: 'Project' }).execute();
    await tx.insertInto('profile_links').values({ user_id: userId, label: 'Site', url: 'https://example.test' }).execute();
    await tx.insertInto('profile_skills').values({ user_id: userId, raw_name: 'TypeScript' }).execute();

    const jd = await tx
      .insertInto('job_descriptions')
      .values({ user_id: userId, source: 'paste', raw_text: 'We need TypeScript.' })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.jobDescription = jd.id;

    const resume = await tx
      .insertInto('resumes')
      .values({ user_id: userId, title: 'Resume', source: 'manual', job_description_id: jd.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.resume = resume.id;

    const gen = await tx
      .insertInto('generations')
      .values({ user_id: userId, kind: 'resume', idempotency_key: `idem-${userId}`, job_description_id: jd.id, resume_id: resume.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.generation = gen.id;
    await tx
      .insertInto('generation_events')
      .values({ generation_id: gen.id, user_id: userId, event: 'stage_started', stage: 'extractJd', snapshot: JSON.stringify({ status: 'generating' }) })
      .execute();

    const version = await tx
      .insertInto('resume_versions')
      .values({
        resume_id: resume.id,
        user_id: userId,
        generation_id: gen.id,
        version_number: 1,
        content: JSON.stringify({ summary: 'x' }),
        content_hash: hash(`${userId}-v1`),
        created_by: 'user',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ids.resumeVersion = version.id;
    await tx.updateTable('resumes').set({ current_version_id: version.id }).where('id', '=', resume.id).execute();

    await tx
      .insertInto('ats_reports')
      .values({
        user_id: userId,
        resume_version_id: version.id,
        rubric_version_id: rubricVersionId,
        reason: 'content_change',
        has_jd: false,
        components: JSON.stringify({}),
        provenance: JSON.stringify({ rubric: 'test-1' }),
      })
      .execute();
    await tx
      .insertInto('cover_letters')
      .values({ user_id: userId, resume_id: resume.id, content: JSON.stringify({ paragraphs: [] }) })
      .execute();
    // P10: an export of that version.
    await tx
      .insertInto('export_events')
      .values({ user_id: userId, resume_id: resume.id, resume_version_id: version.id, format: 'pdf', template_slug: 'nextkin-classic', file_name: 'Graph_Resume.pdf' })
      .execute();
    // toreview §111: the version's typeset pages.
    await tx
      .insertInto('resume_renders')
      .values({ user_id: userId, resume_id: resume.id, resume_version_id: version.id, template_slug: 'jake', template_rev: 2, density: 0, paper: 'letter' })
      .execute();
    await tx
      .insertInto('interview_question_sets')
      .values({ user_id: userId, title: 'Set', questions: JSON.stringify([]) })
      .execute();
    await tx
      .insertInto('saved_jobs')
      .values({ user_id: userId, apply_url_hash: hash(`job-${userId}`), snapshot: JSON.stringify({ title: 'Job' }) })
      .execute();
    await tx
      .insertInto('applications')
      .values({ user_id: userId, job_id: randomUUID(), job: JSON.stringify({ title: 'Job' }) })
      .execute();

    const chat = await tx.insertInto('chat_sessions').values({ user_id: userId }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('chat_messages').values({ session_id: chat.id, user_id: userId, role: 'user', content: 'Hi' }).execute();
    await tx.insertInto('activity').values({ user_id: userId, kind: 'test', title: 'Did a thing' }).execute();
    // P12: a support ticket and a data export.
    await tx.insertInto('support_tickets').values({ user_id: userId, topic: 'question', message: 'Hi' }).execute();
    await tx.insertInto('data_exports').values({ user_id: userId }).execute();
    // P11: a shared ATS report of that document.
    await tx
      .insertInto('shared_reports')
      .values({ user_id: userId, resume_id: resume.id, token_hash: hash(`share-${userId}`), snapshot: JSON.stringify({ total: null }) })
      .execute();
    // P7: an upload and the parse reading it.
    const upload = await tx
      .insertInto('uploads')
      .values({ user_id: userId, purpose: 'resume', bucket: 'nextkin-uploads', object_key: `users/${userId}/uploads/rls-${label}`, file_name: 'cv.pdf', declared_type: 'application/pdf', status: 'clean' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await tx.insertInto('resume_parses').values({ user_id: userId, upload_id: upload.id, status: 'queued' }).execute();
    await tx
      .insertInto('quality_flags')
      .values({ user_id: userId, kind: 'claim_dispute', subject: JSON.stringify({ claim: 'c1' }) })
      .execute();
    await tx.insertInto('security_events').values({ user_id: userId, kind: 'sign_in' }).execute();

    const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
    const sub = await tx
      .insertInto('subscriptions')
      .values({ billing_account_id: account.id, user_id: userId, plan_id: 'free', status: 'active' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await tx
      .insertInto('payments')
      .values({
        billing_account_id: account.id,
        user_id: userId,
        subscription_id: sub.id,
        gateway_payment_id: `pay_${userId}`,
        amount_minor: 0,
        currency: 'USD',
        status: 'succeeded',
        occurred_at: sql<Date>`now()`,
      })
      .execute();
    await tx
      .insertInto('usage_counters')
      .values({ user_id: userId, metric: 'generation', period_start: '2026-10-01', period_end: '2026-11-01' })
      .execute();
    await tx.insertInto('consents').values({ user_id: userId, kind: 'ai_processing', document_version: 'providers-v1' }).execute();
    await tx
      .insertInto('sessions')
      .values({ id_hash: hash(`session-${userId}`), user_id: userId, client: 'web', expires_at: sql<Date>`now() + interval '30 days'` })
      .execute();
    await tx
      .insertInto('idempotency_keys')
      .values({ user_id: userId, key: `key-${userId}`, request_fingerprint: 'fp' })
      .execute();
  });
  return { userId, ids };
}
