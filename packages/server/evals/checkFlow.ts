import { randomUUID } from 'node:crypto';

import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { pageBudget } from '@nextkin/shared/scoring/pageBudget';

import { buildAiGateway } from '../src/ai/build';
import { createMemoryKv } from '../src/cache/kv';
import { loadConfig } from '../src/config';
import { createDatabase } from '../src/db/database';
import { createLatexCompiler } from '../src/export/latex/compile';
import { egressHostsFor, latexEgressHosts, setEgressAllowlist } from '../src/net/egress';
import { createRunner } from '../src/pipeline/runner';
import type { ScanPort } from '../src/scan/scan';
import * as generations from '../src/services/generations';
import { createJd, getJd, runJdExtract } from '../src/services/jd';
import { createResumeFromParse } from '../src/services/resumeImport';
import { getParse, runParse, startParse } from '../src/services/resumeParse';
import { compareResumeToJd } from '../src/services/tailorCompare';
import { scanUpload } from '../src/services/uploads';
import { buildStorage } from '../src/storage/build';
import { capturingPublisher, createUser, deleteUsers, key, log } from '../test/integration/fixtures/pipeline';
import { asDocx, asPdf, FLOW_JOBS, FLOW_RESUMES, type FlowResume } from './flowResumes';

/**
 * `pnpm check:flow` (owner, 2026-11-25): a fixed set of resumes through the whole flow, before a
 * deploy. Upload, scan, read, file as a resume, tailor for a job with every keyword accepted, fit
 * and typeset, each judged pass or fail. In one day the demo failed at five different points of
 * this path, each found by the owner one upload at a time; this is the check that should have
 * found them first.
 *
 * It runs the server's own code against the local stack: real Postgres, storage, model and the
 * sealed compiler. The scanner is a stand-in that answers clean (ClamAV is a profile of its own).
 * A throwaway user holds everything and is deleted at the end.
 *
 *   --quick          upload and read only, no tailoring
 *   --only senior    one resume
 *   --races 5        how many times each upload meets its scan (default 4)
 */

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? '') : null);
const quick = args.includes('--quick');
const only = flag('--only');
const races = Number(flag('--races') ?? '4');

const config = loadConfig();
const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 8 });
const storage = buildStorage(config);
const bucket = config.S3_BUCKET_UPLOADS;
const scanner = { scan: async () => ({ verdict: 'clean' }) } as unknown as ScanPort;
const limits = { documentBytes: config.UPLOAD_MAX_BYTES, avatarBytes: config.AVATAR_MAX_BYTES };
const uploadDeps = { db, storage, bucket, limits, scanner };
const TYPES = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' } as const;

interface Check {
  file: string;
  step: string;
  ok: boolean;
  detail: string;
}
const checks: Check[] = [];
const check = (file: string, step: string, ok: boolean, detail: string) => {
  checks.push({ file, step, ok, detail });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${file.padEnd(14)} ${step.padEnd(8)} ${detail}`);
};

async function upload(userId: string, bytes: Uint8Array, kind: 'docx' | 'pdf'): Promise<string> {
  const objectKey = `users/${userId}/uploads/${randomUUID()}`;
  await storage.write(bucket, objectKey, bytes, TYPES[kind]);
  const row = await db.withUser({ userId, role: 'user' }, (tx) =>
    tx.insertInto('uploads').values({ user_id: userId, purpose: 'resume', bucket, object_key: objectKey, file_name: `resume.${kind}`, declared_type: TYPES[kind], status: 'scanning' }).returning('id').executeTakeFirstOrThrow(),
  );
  return row.id;
}

/** The upload meets its scan, as the browser makes it: the read is asked for while the scan runs. */
async function scanAndStart(userId: string, bytes: Uint8Array, kind: 'docx' | 'pdf', offset: number): Promise<string> {
  const uploadId = await upload(userId, bytes, kind);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const [, parse] = await Promise.all([wait(offset % 3).then(() => scanUpload(uploadDeps, { uploadId, userId }, false)), wait((offset * 2) % 5).then(() => startParse(db, { userId, role: 'user' }, uploadId, null))]);
  return parse.id;
}

const monthsOf = (doc: CanonicalResumeJson, asOf: { year: number; month: number }) => pageBudget(doc, asOf, null);

async function runFile(userId: string, resume: FlowResume, kind: 'docx' | 'pdf', jobIds: string[], deps: { gateway: ReturnType<typeof buildAiGateway>; latex: ReturnType<typeof createLatexCompiler> | undefined }) {
  const file = `${resume.name}.${kind}`;
  const identity = { userId, role: 'user' as const };
  const bytes = kind === 'docx' ? asDocx(resume) : asPdf(resume);

  // 1. The upload and its scan, several times: a read must never be left waiting.
  const parseIds: string[] = [];
  for (let n = 0; n < races; n += 1) parseIds.push(await scanAndStart(userId, bytes, kind, n));
  const waiting = (await Promise.all(parseIds.map((id) => getParse(db, identity, id)))).filter((p) => p.status === 'waiting_scan').length;
  check(file, 'upload', waiting === 0, waiting === 0 ? `${races} uploads, each read started` : `${waiting} of ${races} reads left waiting for a finished scan`);

  // 2. The read.
  const parseId = parseIds.at(-1)!;
  const started = Date.now();
  const outcome = await runParse({ db, storage, gateway: deps.gateway, ocr: async () => Promise.reject(new Error('no OCR in the flow check')), log, maxBytes: limits.documentBytes }, { parseId, userId, correlationId: null }, true).catch((error: unknown) => `threw ${(error as Error).message}`);
  const parse = await getParse(db, identity, parseId);
  if (parse.status !== 'ready') {
    check(file, 'read', false, `${outcome}: ${parse.errorCode ?? ''} ${parse.error ?? ''}`.trim());
    return;
  }
  const row = await db.withUser(identity, (tx) => tx.selectFrom('resume_parses').select('document').where('id', '=', parseId).executeTakeFirstOrThrow());
  const doc = canonicalResumeSchema.parse(row.document);
  const want = resume.expect;
  const kept = doc.roles.map((r) => r.bullets.length);
  const problems = [
    doc.roles.length === want.roles ? '' : `${doc.roles.length} of ${want.roles} jobs`,
    doc.education.length >= want.schools ? '' : `${doc.education.length} of ${want.schools} schools`,
    doc.skills.length >= Math.min(60, want.skills) * 0.7 ? '' : `${doc.skills.length} skills, at least ${Math.round(Math.min(60, want.skills) * 0.7)} wanted`,
    (doc.skillGroups?.length ?? 0) >= want.skillLines * 0.7 ? '' : `${doc.skillGroups?.length ?? 0} of ${want.skillLines} skill lines`,
    (doc.summary?.text.length ?? 0) >= want.summaryChars * 0.8 ? '' : `summary ${doc.summary?.text.length ?? 0} of ${want.summaryChars} characters`,
    want.bulletsPerRole.every((n, i) => (kept[i] ?? 0) >= Math.min(12, n) * 0.7) ? '' : `bullets ${kept.join('/')} of ${want.bulletsPerRole.map((n) => Math.min(12, n)).join('/')}`,
  ].filter(Boolean);
  check(file, 'read', problems.length === 0, problems.length ? problems.join('; ') : `${doc.roles.length} jobs (${kept.join('/')} bullets), ${doc.skills.length} skills, summary ${doc.summary?.text.length ?? 0} chars, ${Math.round((Date.now() - started) / 1000)}s`);

  const filed = await createResumeFromParse(db, identity, parseId).catch((error: unknown) => error as Error);
  if (filed instanceof Error) {
    check(file, 'file', false, filed.message);
    return;
  }
  check(file, 'file', true, 'stored as a resume');
  if (quick) return;

  // 3. Tailor for one job, every missing keyword accepted: the worst case for length.
  const jdId = jobIds[kind === 'docx' ? 0 : 1 % jobIds.length]!;
  const comparison = await compareResumeToJd(db, identity, jdId, filed.id);
  const missing = comparison.keywords.filter((k) => !k.onResume).map((k) => k.label);
  const t = Date.now();
  const { generation } = await generations.startGeneration(db, identity, { kind: 'resume', jdId, baseResumeId: filed.id, tailoring: { fixes: ['headline', 'summary', 'skills', 'experience', 'projects', 'length'], keywords: missing } }, { idempotencyKey: key(), correlationId: null });
  const run = await createRunner({ db, gateway: deps.gateway, publisher: capturingPublisher(), log, ...(deps.latex ? { latex: deps.latex } : {}) }).run({ generationId: generation.id, userId, correlationId: null, receiveCount: 1 }).catch((error: unknown) => error as Error);
  const done = await generations.getGeneration(db, identity, generation.id);
  const tailor = done.tailor as unknown as { score?: number; pages?: number; pageBasis?: string; jobMatch?: { matched: number; total: number } } | undefined;
  if (run instanceof Error || done.status !== 'ready' || !tailor) {
    check(file, 'tailor', false, run instanceof Error ? `${run.name}: ${run.message}` : `ended ${done.status}`);
    return;
  }
  const version = await db.withUser(identity, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', generation.id).executeTakeFirstOrThrow());
  const tailored = canonicalResumeSchema.parse(version.content);
  const now = new Date();
  const budget = monthsOf(tailored, { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }).pages;
  const seconds = Math.round((Date.now() - t) / 1000);
  const baseMatched = comparison.jobMatch?.matched ?? 0;
  const faults = [
    (tailor.score ?? 0) >= (comparison.score ?? 0) ? '' : `score ${tailor.score} below the base's ${comparison.score}`,
    (tailor.jobMatch?.matched ?? 0) >= baseMatched ? '' : `keywords ${tailor.jobMatch?.matched} below the base's ${baseMatched}`,
    (tailor.pages ?? 99) <= budget ? '' : `${tailor.pages} pages, budget ${budget} (${tailor.pageBasis ?? ''})`,
    tailored.summary?.text ? '' : 'no summary',
    tailored.roles.every((r) => r.bullets.length >= 1) ? '' : 'a job with no bullets',
    /(\p{L}{3,})\s+\1\b/iu.test(tailored.roles.flatMap((r) => r.bullets.map((b) => b.text)).join(' | ')) ? 'a doubled word in a bullet' : '',
  ].filter(Boolean);
  check(file, 'tailor', faults.length === 0, faults.length ? faults.join('; ') : `score ${comparison.score} to ${tailor.score}, ${tailor.jobMatch?.matched}/${tailor.jobMatch?.total} keywords, ${tailor.pages} of ${budget} pages${deps.latex ? '' : ' (estimated)'}, bullets ${tailored.roles.map((r) => r.bullets.length).join('/')}, ${seconds}s`);
}

async function main() {
  setEgressAllowlist([...egressHostsFor(config), ...latexEgressHosts(config)]);
  const gateway = buildAiGateway(config, db, log);
  const latexUp = await fetch(`${config.LATEX_COMPILER_URL}/health`, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok).catch(() => false);
  const latex = latexUp && (config.LATEX_COMPILER_TOKEN || config.LATEX_COMPILER_TOKEN_FILE) ? createLatexCompiler(config) : undefined;
  if (!latex) console.log('note: the LaTeX service is not reachable; page counts are estimates (start it with the latex profile)');

  const users: string[] = [];
  const userId = await createUser(db, users, 'pro');
  const identity = { userId, role: 'user' as const };
  try {
    const jobIds: string[] = [];
    if (!quick) {
      for (const job of FLOW_JOBS) {
        const draft = await createJd(db, identity, { source: 'paste', text: job.text }, null);
        await runJdExtract({ db, gateway, cache: createMemoryKv(), log }, { jdId: draft.id, userId, correlationId: null }, true);
        const jd = await getJd(db, identity, draft.id);
        check(job.name, 'job', jd.status === 'ready', jd.status === 'ready' ? `${(jd.requiredSkills?.length ?? 0) + (jd.preferredSkills?.length ?? 0)} keywords` : `ended ${jd.status}`);
        if (jd.status === 'ready') jobIds.push(draft.id);
      }
      if (jobIds.length === 0) throw new Error('no job description could be read');
    }
    for (const resume of FLOW_RESUMES.filter((r) => !only || r.name === only)) {
      for (const kind of ['docx', 'pdf'] as const) {
        await runFile(userId, resume, kind, jobIds, { gateway, latex }).catch((error: unknown) => check(`${resume.name}.${kind}`, 'crashed', false, `${(error as Error).name}: ${(error as Error).message}`.slice(0, 300)));
      }
    }
  } finally {
    await deleteUsers(db, users);
    await db.destroy();
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed${failed.length ? `; failed: ${failed.map((c) => `${c.file} ${c.step}`).join(', ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
