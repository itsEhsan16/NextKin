import {
  contentNeedsReview,
  RESUME_SECTION_ORDER,
  type DocumentContent,
  type Resume,
  type ResumeContent,
  type ResumeSectionKey,
} from '@/data/models';
import { formatRelativeTimeLong } from '@/lib';

/**
 * NextKin V2 spec §7.11 / §7.9 — the document editor's pure decisions, kept out of the screen so
 * each one can be unit-tested without a mount. Nothing here reads the theme or the query cache.
 */

/** Roles printed before the rest collapse behind the editor's "Show N more roles" disclosure. */
export const COLLAPSED_ROLES = 2;

/** §7.9's pill on an entry the product assumed rather than read. */
export const REVIEW_PILL = 'Check this — we assumed it';

/** §13.3: the free format is stated on the bar, so the download never looks like a paywall. */
export const FREE_NOTE = 'PDF is always free';

/** Whether one §7.11 section is holding nothing — the editor draws an "Add …" tile instead. */
export function resumeSectionIsEmpty(content: ResumeContent, section: ResumeSectionKey): boolean {
  switch (section) {
    case 'summary':
      return content.summary.trim().length === 0;
    case 'skills':
      return content.skills.length === 0;
    case 'experience':
      return content.experience.length === 0;
    case 'projects':
      return content.projects.length === 0;
    case 'certifications':
      return content.certifications.length === 0;
    case 'education':
      return content.education.length === 0;
  }
}

/**
 * A scratch document: created, never written. Six empty cards would read as six broken ones, so
 * the editor shows one empty state and points at the summary instead.
 *
 * A letter counts as empty only when both the greeting and every paragraph are blank — a signoff
 * alone is boilerplate the builder writes, not something the reader typed.
 */
export function documentIsEmpty(content: DocumentContent): boolean {
  if (content.kind === 'cover_letter') {
    return (
      content.greeting.trim().length === 0 &&
      content.paragraphs.every((paragraph) => paragraph.trim().length === 0)
    );
  }
  return RESUME_SECTION_ORDER.every((section) => resumeSectionIsEmpty(content, section));
}

/**
 * V2 §7.9's download gate. It reads BOTH halves on purpose: `res_zoho` carries an assumed role in
 * its body with no flag on the document, and a Zero Resume Mode draft can carry the flag on the
 * document with nothing flagged in the body (a skill claim is a plain string and cannot hold one).
 * Reading either half alone lets the library card and the editor disagree about the same document.
 */
export function downloadBlocked(resume: Resume, content?: DocumentContent): boolean {
  if (content && contentNeedsReview(content)) return true;
  return resume.needsReview === true;
}

/**
 * Why the primary is inert. A disabled control is never silently inert — this line replaces the
 * free-format note on the bar and is what the action bar announces.
 */
export function gateReason(content?: DocumentContent): string {
  return content?.kind === 'cover_letter'
    ? 'Confirm what we assumed in this letter before you download it.'
    : 'Confirm the roles we assumed before you download this.';
}

/** "v5 · edited 2 days ago" — the meta strip's one line about the document's history. */
export function versionLine(resume: Resume, now: Date = new Date()): string {
  const edited = formatRelativeTimeLong(resume.updatedAt, now);
  return edited ? `v${resume.versionCount} · edited ${edited}` : `v${resume.versionCount}`;
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** "Four", as the boards spell a small count at the start of a sentence; digits past nine. */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/**
 * The editor hero's one-line AI note (RESUMES 06 577:6974): how many of the score's quick wins
 * are still open. "Airtight" is only promised to a document already in the strong band.
 */
export function quickWinsNote(quickWins: number, strong: boolean): string {
  if (quickWins === 0) return 'No quick wins left on this one.';
  const wins = quickWins === 1 ? 'quick win' : 'quick wins';
  return strong
    ? `${countWord(quickWins)} ${wins} left before it is airtight.`
    : `${countWord(quickWins)} ${wins} can lift this score.`;
}
