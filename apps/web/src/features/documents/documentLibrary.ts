import type {
  CareerDocument,
  CareerDocumentFormat,
  CareerDocumentKind,
} from '@nextkin/shared/models';

import { formatFileSize, formatUpdated } from '@/lib/format';
import type { TagTone } from '@/ui/Tag';

/**
 * How the Documents board (286:2026) names, groups and orders the library. See `toreview.md` §19.
 */

/** Each kind on its tag and at the head of its meta line (286:2127, 2129). */
export const KIND_LABEL: Record<CareerDocumentKind, string> = {
  certificate: 'Certificate',
  cover_letter: 'Cover Letter',
  id_proof: 'ID Proof',
  resume: 'Resume',
  other: 'Other',
};

/** The tags' tones as drawn (286:2128, 2142, 2156, 2170, 2184). */
export const KIND_TONE: Record<CareerDocumentKind, TagTone> = {
  certificate: 'brand',
  cover_letter: 'info',
  id_proof: 'success',
  resume: 'warning',
  other: 'neutral',
};

export const FORMAT_LABEL: Record<CareerDocumentFormat, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  jpg: 'JPG',
};

/**
 * The pills (286:2058-2067), in the board's order. "Other" holds every kind without a pill of its
 * own, the board's résumé included, which is how its counts add up to its twelve.
 */
export type DocumentTab = 'all' | 'certificate' | 'cover_letter' | 'id_proof' | 'other';

export const DOCUMENT_TABS: readonly { id: DocumentTab; label: string }[] = [
  { id: 'all', label: 'All Documents' },
  { id: 'certificate', label: 'Certificates' },
  { id: 'cover_letter', label: 'Cover Letters' },
  { id: 'id_proof', label: 'ID Proofs' },
  { id: 'other', label: 'Other' },
];

const PILLED = new Set<CareerDocumentKind>(['certificate', 'cover_letter', 'id_proof']);

export function inTab(tab: DocumentTab, document: CareerDocument): boolean {
  if (tab === 'all') return true;
  if (tab === 'other') return !PILLED.has(document.kind);
  return document.kind === tab;
}

export function countByTab(documents: CareerDocument[]): Record<DocumentTab, number> {
  const counts = {} as Record<DocumentTab, number>;
  for (const { id } of DOCUMENT_TABS) {
    counts[id] = documents.filter((document) => inTab(id, document)).length;
  }
  return counts;
}

/**
 * "Last updated" beside the search (286:2074) and "Sort by: Last updated" over the list
 * (286:2117): one order behind both. The board draws only the default; the other two are ours.
 */
export type DocumentSort = 'updated' | 'name' | 'size';

export const DOCUMENT_SORT_OPTIONS: Record<DocumentSort, string> = {
  updated: 'Last updated',
  name: 'Name',
  size: 'Largest first',
};

export const DOCUMENT_COMPARATORS: Record<
  DocumentSort,
  (a: CareerDocument, b: CareerDocument) => number
> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title),
  name: (a, b) => a.title.localeCompare(b.title),
  size: (a, b) => b.sizeBytes - a.sizeBytes || a.title.localeCompare(b.title),
};

/** "Certificate • 2.4 MB • Updated 2 days ago" (286:2127). */
export const documentMeta = (document: CareerDocument): string =>
  [
    KIND_LABEL[document.kind],
    formatFileSize(document.sizeBytes),
    formatUpdated(document.updatedAt),
  ].join(' • ');

/**
 * "Search documents…" (286:2069): over the title and the kind, and the company and role a letter
 * is for, and a certificate's issuer (redesign R6d, audit DC-07), as the resume search covers
 * companies.
 */
export function matchesDocumentSearch(document: CareerDocument, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    document.title,
    KIND_LABEL[document.kind],
    document.coverLetter?.company,
    document.coverLetter?.role,
    document.certificate?.issuer,
  ].some((field) => field?.toLowerCase().includes(needle));
}

/** The list's two layouts (286:2080, 286:2084). The board draws the list; the grid is ours. */
export type DocumentView = 'list' | 'grid';
