import type { Resume } from '@/data/models';
import { formatRelativeTimeLong, pluralize } from '@/lib';

/**
 * "2 days ago", but "last week" / "last month" where the count is one — the way TAILOR 01
 * (606:193) words a week-old resume ("Updated last week").
 */
function updatedAgo(iso: string, now: Date): string {
  const ago = formatRelativeTimeLong(iso, now);
  if (ago === '1 week ago') return 'last week';
  if (ago === '1 month ago') return 'last month';
  return ago;
}

/**
 * The tailor sheet's row meta (TAILOR 01 606:165 / 606:180): "Base resume · 3 pages · Updated 2
 * days ago" for the base, "For Google · Updated 2 days ago" for a tailored copy. `docSubtitle`
 * is the library's line ("PDF and DOCX ready"), which says nothing about how fresh the resume is.
 */
export function tailorResumeMeta(resume: Resume, now: Date = new Date()): string {
  const updated = `Updated ${updatedAgo(resume.updatedAt, now)}`;
  if (resume.isBase) {
    return [
      'Base resume',
      resume.pageCount != null ? pluralize(resume.pageCount, 'page') : undefined,
      updated,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [resume.targetCompany ? `For ${resume.targetCompany}` : undefined, updated]
    .filter(Boolean)
    .join(' · ');
}

/** "Uploaded just now · 2 pages" (TAILOR 01b 606:386); the count only when the parse knows it. */
export function uploadedMeta(resume: Resume, now: Date = new Date()): string {
  return [
    `Uploaded ${formatRelativeTimeLong(resume.createdAt, now)}`,
    resume.pageCount != null ? pluralize(resume.pageCount, 'page') : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

// The pick rules are shared with the web dialog (toreview §110).
export { defaultTailorPick, tailorableResumes } from '@/data/models';
