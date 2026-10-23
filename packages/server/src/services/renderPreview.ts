import { contentNeedsReview } from '@nextkin/shared/models/resumeContent';
import type { ResumePreview } from '@nextkin/shared/schemas/resumePreview';

import type { Identity } from '../db/database';
import { exportFileName } from '../export/model';
import { errors } from '../http/errors';
import { MAX_PRESIGN_GET_SECONDS } from '../storage/storage';
import { LATEX_STYLES } from '../export/latex/styles';
import { isTransient, queueRender, renderTemplateOf, retryRender, type PageImage, type RenderDeps } from './renders';
import { contentOf } from './resumeRead';

/**
 * The preview of a resume version's typeset pages (toreview §111). No export gate applies: seeing
 * one's own resume is not exporting it. A version with no render yet (written before renders
 * existed) is queued here. While a version is typeset, the latest earlier pages stay up, flagged
 * stale. An open Zero Resume review shows the structured preview, as the export would refuse.
 */

/** A render that failed because the compile service was down is tried again after this long. */
const RETRY_AFTER_MS = 2 * 60_000;

type RenderRow = { id: string; status: string; resume_version_id: string; page_keys: unknown; page_count: number | null; paper: string; pdf_key: string | null };

async function signed(deps: RenderDeps, row: RenderRow, fileName: string) {
  const pages = await Promise.all(
    ((row.page_keys ?? []) as PageImage[]).map(async (p) => ({ url: await deps.storage.presignGet(deps.bucket, p.key, { seconds: MAX_PRESIGN_GET_SECONDS }), width: p.width, height: p.height })),
  );
  const pdfUrl = row.pdf_key ? await deps.storage.presignGet(deps.bucket, row.pdf_key, { seconds: MAX_PRESIGN_GET_SECONDS, downloadName: fileName }) : undefined;
  return {
    pages,
    ...(pdfUrl ? { pdfUrl } : {}),
    ...(row.page_count ? { pageCount: row.page_count } : {}),
    paper: row.paper === 'a4' ? ('a4' as const) : ('letter' as const),
    expiresAt: new Date(Date.now() + MAX_PRESIGN_GET_SECONDS * 1000).toISOString(),
  };
}

export async function resumePreview(deps: RenderDeps, identity: Identity, resumeId: string, versionId?: string, correlationId: string | null = null): Promise<ResumePreview> {
  const found = await deps.db.withUser(identity, async (tx) => {
    const resume = await tx.selectFrom('resumes').select(['id', 'doc_type', 'current_version_id', 'title', 'target_role']).where('id', '=', resumeId).where('trashed_at', 'is', null).executeTakeFirst();
    if (!resume) throw errors.notFound('resume');
    const id = versionId ?? resume.current_version_id;
    const version = id ? await tx.selectFrom('resume_versions').select(['id', 'content']).where('id', '=', id).where('resume_id', '=', resumeId).executeTakeFirst() : undefined;
    if (!version) throw errors.notFound('version');
    const content = contentOf(resume.doc_type, version.content, { resumeId, versionId: version.id });
    if (resume.doc_type !== 'resume' || !content || contentNeedsReview(content)) return { versionId: version.id, structured: true as const };

    // This version's pages are in its own template; an earlier version's, in any current template,
    // stay up while it is typeset (a template switch shows the old look until the new one is ready).
    const template = renderTemplateOf(version.content);
    const currentRev = (r: { template_slug: string; template_rev: number }) => Object.values(LATEX_STYLES).some((s) => s.slug === r.template_slug && s.rev === r.template_rev);
    const renders = await tx
      .selectFrom('resume_renders')
      .select(['id', 'status', 'resume_version_id', 'page_keys', 'page_count', 'paper', 'pdf_key', 'error_code', 'completed_at', 'created_at', 'template_slug', 'template_rev'])
      .where('resume_id', '=', resumeId)
      .orderBy('created_at', 'desc')
      .limit(30)
      .execute()
      .then((rows) => rows.filter(currentRev));
    const own = renders.filter((r) => r.resume_version_id === version.id && r.template_slug === template.slug && r.template_rev === template.rev);
    let current = own.find((r) => r.status === 'ready') ?? own.find((r) => r.status === 'pending') ?? own[0];
    if (!current) await queueRender(tx, { userId: identity.userId, resumeId, versionId: version.id, correlationId });
    else if (current.status === 'failed' && isTransient(current.error_code) && Date.now() - (current.completed_at?.getTime() ?? 0) > RETRY_AFTER_MS) {
      await retryRender(tx, { id: current.id, userId: identity.userId }, correlationId);
      current = { ...current, status: 'pending' };
    }
    const earlier = renders.find((r) => r.status === 'ready' && !own.includes(r));
    const header = (version.content as { header?: { name?: string } } | null)?.header?.name;
    const user = header ? null : await tx.selectFrom('users').select(['first_name', 'last_name']).where('id', '=', identity.userId).executeTakeFirst();
    const name = header ?? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
    return { versionId: version.id, current, earlier, fileName: exportFileName(name, resume.target_role ?? resume.title, 'pdf') };
  });

  if ('structured' in found) return { status: 'structured', versionId: found.versionId, pages: [] };
  const { current, earlier, fileName } = found;
  if (current?.status === 'ready') return { status: 'ready', versionId: found.versionId, ...(await signed(deps, current, fileName)) };
  if (current?.status === 'failed') return { status: 'failed', versionId: found.versionId, pages: [] };
  if (earlier) {
    // The earlier pages stay up while this version is typeset; their PDF is not this version's, so it is not offered.
    const shown = await signed(deps, earlier, fileName);
    return { status: 'pending', versionId: found.versionId, pages: shown.pages, paper: shown.paper, expiresAt: shown.expiresAt, ...(shown.pageCount ? { pageCount: shown.pageCount } : {}), stale: true };
  }
  return { status: 'pending', versionId: found.versionId, pages: [] };
}
