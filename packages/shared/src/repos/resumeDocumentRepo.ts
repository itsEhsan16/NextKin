import { simulate } from '../mock';
import type { ResumeDocument, ResumeDocumentWrite } from '../models';
import type { CanonicalResumeJson } from '../schemas/resumeContent';
import { toResumeContent } from '../scoring/canonical';
import { canonicalFromContent } from '../scoring/fromContent';
import { applyDocument, documentOf } from '../scoring/resumeDocument';
import { exportProblem } from '../scoring/resumeDocumentCheck';

import { ApiError } from './http/client';
import { bumpVersion, saveContent } from './documentWrites';
import { clone, findOrThrow, type MockStore, NotFoundError } from './state';
import type { ResumesRepo } from './types';

/**
 * The resume editor's document on the mock (toreview §124). The mock stores the editor-content
 * body, so the document is lifted from it; what that body cannot hold (the header, custom
 * sections, the template) is kept here by version, so a reload reads back what was saved.
 * Saves name the version they were read from: one made against an older version is refused as
 * the server refuses it (PRECONDITION_FAILED), never merged over the newer one.
 */
export type ResumeDocumentRepo = Pick<ResumesRepo, 'getDocument' | 'saveDocument'>;

export function createResumeDocumentRepo(store: MockStore): ResumeDocumentRepo {
  const canonicals = new Map<string, CanonicalResumeJson>();

  const read = (id: string) => {
    const resume = findOrThrow(store.state.resumes, id, 'Resume');
    const content = store.state.contents[id];
    if (!content || content.kind !== 'resume') throw new NotFoundError('ResumeDocument', id);
    const canonical = canonicals.get(content.versionId) ?? canonicalFromContent(content);
    return { resume, content, canonical };
  };

  const owner = () => {
    const { user, profile } = store.state;
    return {
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      ...(profile.phone ? { phone: profile.phone } : {}),
      ...(profile.location ? { location: profile.location } : {}),
    };
  };

  return {
    getDocument: (id) =>
      simulate(() => {
        const { content, canonical } = read(id);
        return clone(documentOf(canonical, { resumeId: id, versionId: content.versionId, revision: content.versionId }, owner()));
      }),

    saveDocument: (id, write: ResumeDocumentWrite, baseRevision: string) =>
      simulate((): ResumeDocument => {
        const { resume, content, canonical } = read(id);
        if (content.versionId !== baseRevision) throw new ApiError('PRECONDITION_FAILED', 'This resume changed somewhere else since you opened it.', 412);
        const next = applyDocument(canonical, clone(write));
        const { versionId } = bumpVersion(store, resume, 'Edited in the editor');
        canonicals.set(versionId, next);
        // A draft until it could be downloaded, as the server says (toreview §124).
        const draft = exportProblem(next, { name: '—' }) !== null;
        store.state.resumes = store.state.resumes.map((r) => {
          if (r.id !== id) return r;
          const { draft: _was, ...rest } = r;
          return draft ? { ...rest, draft: true } : rest;
        });
        saveContent(store, id, toResumeContent(next, { resumeId: id, versionId }), versionId);
        return clone(documentOf(next, { resumeId: id, versionId, revision: versionId }, owner()));
      }),
  };
}
