import { simulate } from '../mock';
import type { CareerDocument } from '../models';

import { clone, type MockStore } from './state';
import type { DocumentsRepo } from './types';

const byUpdatedDesc = (a: CareerDocument, b: CareerDocument): number =>
  b.updatedAt.localeCompare(a.updatedAt);

/**
 * The candidate's own files (Figma 286:2026). Read-only in the mock: uploading, opening and
 * sharing a file all need storage, which the API brings (V2 §9.4's presigned URLs).
 */
export function createMockDocumentsRepo(store: MockStore): DocumentsRepo {
  return {
    list: () =>
      simulate(() => clone([...store.state.documents].sort(byUpdatedDesc)), {
        empty: () => [],
      }),
  };
}
