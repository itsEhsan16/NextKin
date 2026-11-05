import type { KbTab } from '@nextkin/shared/models';

const TAB_EMPTY: Record<Exclude<KbTab, 'all'>, string> = {
  review: 'No technology has a change waiting for review.',
  reports: 'No technology has an open user report.',
  imports: 'No entry came in from an import.',
};

/** What an empty table says: a page past the end, a search, a tab or dataset, or an empty KB. */
export function emptyCopy({
  page,
  query,
  tab,
  dataset,
}: {
  page: number;
  query: string;
  tab: KbTab;
  dataset: string | null;
}): { title: string; message: string } {
  if (page > 1) return { title: 'Nothing on this page', message: 'Go back a page to see entries.' };
  if (query) return { title: 'Nothing matches', message: 'Try another name or alias.' };
  if (tab !== 'all') return { title: 'Nothing here', message: TAB_EMPTY[tab] };
  if (dataset) return { title: 'Nothing here', message: `No entry is in dataset ${dataset}.` };
  return { title: 'The KB is empty', message: 'Add a technology or import a file to start.' };
}
