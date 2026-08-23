import { newId, simulate } from '@/data/mock';
import type { AtsScore, Resume } from '@/data/models';

import { clone, findOrThrow, type MockStore, NotFoundError } from './state';
import type { ResumesRepo } from './types';

const byUpdatedDesc = (a: Resume, b: Resume): number => b.updatedAt.localeCompare(a.updatedAt);

export function createMockResumesRepo(store: MockStore): ResumesRepo {
  const find = (id: string): Resume => findOrThrow(store.state.resumes, id, 'Resume');

  return {
    list: () =>
      simulate(() => clone([...store.state.resumes].sort(byUpdatedDesc)), { empty: () => [] }),

    get: (id) => simulate(() => clone(find(id))),

    getScore: (id) =>
      simulate(() => {
        find(id);
        const score: AtsScore | undefined = store.state.atsScores[id];
        if (!score) throw new NotFoundError('AtsScore', id);
        return clone(score);
      }),

    getVersions: (id) =>
      simulate(
        () =>
          clone(
            store.state.resumeVersions
              .filter((version) => version.resumeId === id)
              .sort((a, b) => b.version - a.version),
          ),
        { empty: () => [] },
      ),

    duplicate: (id) =>
      simulate(() => {
        const source = find(id);
        const now = new Date().toISOString();
        const copyId = newId('res');
        const versionId = newId('ver');
        const copy: Resume = {
          ...source,
          id: copyId,
          title: `${source.title} (copy)`,
          createdAt: now,
          updatedAt: now,
          versionCount: 1,
          currentVersionId: versionId,
          tags: [...source.tags],
        };
        store.state.resumes = [copy, ...store.state.resumes];
        store.state.resumeVersions = [
          ...store.state.resumeVersions,
          { id: versionId, resumeId: copyId, version: 1, createdAt: now, changeNote: 'Duplicated' },
        ];
        const score = store.state.atsScores[id];
        if (score) store.state.atsScores[copyId] = clone(score);
        return clone(copy);
      }),

    rename: (id, title) =>
      simulate(() => {
        const current = find(id);
        const updated: Resume = {
          ...current,
          title: title.trim(),
          updatedAt: new Date().toISOString(),
        };
        store.state.resumes = store.state.resumes.map((resume) =>
          resume.id === id ? updated : resume,
        );
        return clone(updated);
      }),

    remove: (id) =>
      simulate(() => {
        find(id);
        store.state.resumes = store.state.resumes.filter((resume) => resume.id !== id);
        store.state.resumeVersions = store.state.resumeVersions.filter(
          (version) => version.resumeId !== id,
        );
        delete store.state.atsScores[id];
      }),
  };
}
