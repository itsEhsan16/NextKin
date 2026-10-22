import { useQuery } from '@tanstack/react-query';

import { repos } from '../repos';

import { qk } from './keys';

/** The candidate's own files (Figma 286:2026), newest first, in one call. */
export function useDocuments() {
  return useQuery({
    queryKey: qk.documents.list(),
    queryFn: () => repos.documents.list(),
  });
}
