import { createHash } from 'node:crypto';

import { MARKETS, marketForLocation, paperForLocation, type MarketProfile } from '@nextkin/engines/markets';
import { pageBudget } from '@nextkin/shared/scoring/pageBudget';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { parseFindingsSchema } from '@nextkin/shared/schemas/uploads';

import type { Database, Identity, Tx } from '../db/database';
import { decorativeSymbolsIn } from '../export/latex/escape';
import { LatexCompileError, type LatexCompiler } from '../export/latex/compile';
import { latexResumeOf } from '../export/latex/fromCanonical';
import { texOf } from '../export/latex/jakeTemplate';
import { styleOf } from '../export/latex/styles';
import { lintTex } from '../export/latex/texLint';
import type { LatexDensity, LatexResume } from '../export/latex/types';
import type { Identity as Who } from '../export/model';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import type { StoragePort } from '../storage/storage';

/**
 * LaTeX renders of resume versions (toreview §111). Every resume version is typeset once per
 * template revision, density and paper on the worker, and its PDF and page images are kept, so the
 * preview shows the pages the download holds. The name and contact printed are the version's own
 * header when its file had one, else the account's (`latexResumeOf`).
 */

/** The template a version is typeset in, and that template's current revision (toreview §124). */
export const renderTemplateOf = (content: unknown): { slug: string; rev: number } => {
  const style = styleOf((content as { template?: string } | null)?.template);
  return { slug: style.slug, rev: style.rev };
};

export interface RenderDeps {
  db: Database;
  storage: StoragePort;
  bucket: string;
}

export interface PageImage {
  key: string;
  width: number;
  height: number;
}

/** The paper the user's resumes are set on: by their own location (toreview §130). */
export async function userPaper(tx: Tx, userId: string): Promise<LatexResume['paper']> {
  const row = await tx.selectFrom('profiles').select('location').where('user_id', '=', userId).executeTakeFirst();
  return paperForLocation(row?.location);
}

/** Queues a render of a version, once per template revision, density and paper. */
export async function queueRender(
  tx: Tx,
  args: { userId: string; resumeId: string; versionId: string; density?: LatexDensity; paper?: LatexResume['paper']; correlationId?: string | null },
): Promise<string | null> {
  const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', args.versionId).executeTakeFirstOrThrow();
  const template = renderTemplateOf(version.content);
  const inserted = await tx
    .insertInto('resume_renders')
    .values({
      user_id: args.userId,
      resume_id: args.resumeId,
      resume_version_id: args.versionId,
      template_slug: template.slug,
      template_rev: template.rev,
      density: args.density ?? 0,
      paper: args.paper ?? (await userPaper(tx, args.userId)),
    })
    .onConflict((oc) => oc.columns(['resume_version_id', 'template_slug', 'template_rev', 'density', 'paper']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) return null;
  await enqueue(tx, { queue: 'generation-priority', groupId: `${args.userId}#render`, type: 'render.compile', payload: { renderId: inserted.id, userId: args.userId }, correlationId: args.correlationId ?? null });
  return inserted.id;
}

/** Who the resume belongs to, as the account states it, and the market its dates are written for. */
export async function subjectOf(tx: Tx, userId: string, jdId: string | null): Promise<{ who: Who; market: MarketProfile }> {
  const u = await tx.selectFrom('users as u').leftJoin('profiles as p', 'p.user_id', 'u.id').select(['u.first_name', 'u.last_name', 'u.email', 'p.phone', 'p.location']).where('u.id', '=', userId).executeTakeFirstOrThrow();
  const jd = jdId ? await tx.selectFrom('job_descriptions').select(['extracted', 'edited']).where('id', '=', jdId).executeTakeFirst() : undefined;
  const jdLocation = ((jd?.edited as { location?: string } | null)?.location ?? (jd?.extracted as { location?: string | null } | null)?.location) || undefined;
  const who: Who = { name: `${u.first_name} ${u.last_name}`.trim() || 'Your Name', email: u.email, ...(u.phone ? { phone: u.phone } : {}), ...(u.location ? { location: u.location } : {}) };
  return { who, market: MARKETS.profiles[marketForLocation(jdLocation ?? u.location ?? undefined) ?? 'us'] };
}

/** The version's .tex source, linted. A lint failure is the template's fault, never the user's. */
export function sourceOf(doc: CanonicalResumeJson, who: Who, options: { density: LatexDensity; paper: LatexResume['paper']; market: MarketProfile }) {
  const tex = texOf(latexResumeOf(doc, who, options), styleOf(doc.template));
  const lint = lintTex(tex);
  return { tex, lint, sha256: createHash('sha256').update(tex).digest('hex') };
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return png.byteLength >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : { width: 0, height: 0 };
}

export const renderPrefix = (userId: string, versionId: string) => `users/${userId}/renders/${versionId}/`;

/** Failures that will fail again on retry: the source itself was refused. */
const PERMANENT = new Set(['lint', 'compile', 'rejected']);
/** Failures of the service, not the source: the preview queues these again after a pause. */
export const isTransient = (code: string | null) => !!code && !PERMANENT.has(code);

export async function failRender(db: Database, payload: { renderId: string; userId: string }, code: string): Promise<'failed'> {
  await db.withUser({ userId: payload.userId, role: 'user' }, (tx) =>
    tx.updateTable('resume_renders').set({ status: 'failed', error_code: code, completed_at: new Date() }).where('id', '=', payload.renderId).where('status', '=', 'pending').execute(),
  );
  return 'failed';
}

/** Queues a failed render again: its row goes back to pending under the same id. */
export async function retryRender(tx: Tx, render: { id: string; userId: string }, correlationId: string | null): Promise<void> {
  const reset = await tx.updateTable('resume_renders').set({ status: 'pending', error_code: null, completed_at: null }).where('id', '=', render.id).where('status', '=', 'failed').returning('id').executeTakeFirst();
  if (reset) await enqueue(tx, { queue: 'generation-priority', groupId: `${render.userId}#render`, type: 'render.compile', payload: { renderId: render.id, userId: render.userId }, correlationId });
}

/** The worker's half: typeset, compile, store, record. A finished render is left alone. */
export async function runRender(deps: RenderDeps & { latex: LatexCompiler; log: Logger }, payload: { renderId: string; userId: string }, lastAttempt: boolean): Promise<'rendered' | 'skipped' | 'failed'> {
  const identity: Identity = { userId: payload.userId, role: 'user' };
  const job = await deps.db.withUser(identity, async (tx) => {
    const render = await tx.selectFrom('resume_renders').selectAll().where('id', '=', payload.renderId).executeTakeFirst();
    if (!render || render.status !== 'pending') return null;
    const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', render.resume_version_id).executeTakeFirstOrThrow();
    const resume = await tx.selectFrom('resumes').select('job_description_id').where('id', '=', render.resume_id).executeTakeFirstOrThrow();
    // An uploaded resume's own length stays the reference for every version of it.
    const parse = await tx.selectFrom('resume_parses').select('findings').where('resume_id', '=', render.resume_id).orderBy('created_at', 'desc').executeTakeFirst();
    const findings = parse ? parseFindingsSchema.safeParse(parse.findings) : undefined;
    return { render, version, sourcePages: findings?.success ? (findings.data.pages ?? null) : null, ...(await subjectOf(tx, payload.userId, resume.job_description_id)) };
  });
  if (!job) return 'skipped';
  const { render } = job;

  const fail = (code: string) => {
    deps.log.warn({ event: 'render.failed', code }, 'render failed');
    return failRender(deps.db, payload, code);
  };

  const doc = canonicalResumeSchema.parse(job.version.content);
  const now = new Date();
  const budget = pageBudget(doc, { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }, job.sourcePages);
  // The density ladder: the template as designed, then tighter spacing, until the pages fit the
  // budget. Only spacing changes here; a render never drops a line of the version it shows.
  let density = render.density as LatexDensity;
  let source;
  let result;
  for (;;) {
    source = sourceOf(doc, job.who, { density, paper: render.paper as LatexResume['paper'], market: job.market });
    if (density === 0) {
      const dropped = decorativeSymbolsIn(JSON.stringify(doc));
      // Emoji and decorative symbols are left out of the PDF (toreview §130); say so in the log.
      if (dropped > 0) deps.log.info({ event: 'render.symbols_dropped', count: dropped }, 'decorative symbols left out of the PDF');
    }
    if (!source.lint.ok) {
      deps.log.error({ event: 'render.lint_failed', problems: source.lint.problems.slice(0, 5) }, 'the template wrote TeX the lint refused');
      return fail('lint');
    }
    try {
      result = await deps.latex.compile(source.tex);
    } catch (error) {
      const kind = error instanceof LatexCompileError ? error.kind : 'unavailable';
      if (!PERMANENT.has(kind) && !lastAttempt) throw error; // redelivered with backoff
      if (error instanceof LatexCompileError && kind === 'compile') deps.log.error({ event: 'render.compile_failed', log: error.log.slice(-8) }, 'Tectonic refused the source');
      return fail(kind);
    }
    if (result.pages <= budget.pages || density === 2) break;
    density = (density + 1) as LatexDensity;
  }

  const prefix = renderPrefix(payload.userId, render.resume_version_id);
  const pdfKey = `${prefix}${render.id}.pdf`;
  await deps.storage.write(deps.bucket, pdfKey, result.pdf, 'application/pdf');
  const pages: PageImage[] = [];
  for (const [i, png] of result.pngs.entries()) {
    const key = `${prefix}${render.id}-p${i + 1}.png`;
    await deps.storage.write(deps.bucket, key, png, 'image/png');
    pages.push({ key, ...pngSize(png) });
  }
  await deps.db.withUser(identity, (tx) =>
    tx
      .updateTable('resume_renders')
      .set({ status: 'ready', density, pdf_key: pdfKey, page_keys: JSON.stringify(pages), page_count: result.pages, size_bytes: result.pdf.byteLength, tex_sha256: source.sha256, completed_at: new Date() })
      .where('id', '=', render.id)
      .where('status', '=', 'pending')
      .execute(),
  );
  deps.log.info({ event: 'render.ready', pages: result.pages, budget: budget.pages, density, ms: result.ms, bytes: result.pdf.byteLength }, 'resume rendered');
  return 'rendered';
}
