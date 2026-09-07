import type { Certification, Education, Experience, ProfileDraft } from '@/data/models';
import { formatMonthYear, pluralize } from '@/lib';

/**
 * The accepted-row model behind the upload review (V2 §7.4).
 *
 * §7.4 is emphatic that parsing an upload yields a DRAFT and that nothing reaches the profile
 * until the reader accepts rows, so "which rows are in" is a first-class value rather than
 * something the screen keeps in its head. It is pure and lives here for the same reason
 * `jdSkillEdits` does: how sure the parser is about a row is a rule about the parse, not about
 * the page that draws it.
 */

/** One acceptable line: a headline, a role, a qualification, a credential or a skill. */
export type ImportRow = {
  /** Stable within one draft; the acceptance set is keyed by it. */
  key: string;
  title: string;
  caption?: string;
  /**
   * Why the parse is unsure. A row that has one starts REJECTED and wears the text as a pill —
   * §7.9's rule, applied to §7.4: nothing assumed is presented as known.
   */
  warning?: string;
};

export type ImportGroupKey = 'headline' | 'experiences' | 'education' | 'certifications' | 'skills';

export type ImportGroup = { key: ImportGroupKey; title: string; rows: ImportRow[] };

export const HEADLINE_KEY = 'headline';

const expKey = (entry: Experience, index: number) => `exp:${entry.id || index}`;
const eduKey = (entry: Education, index: number) => `edu:${entry.id || index}`;
const certKey = (entry: Certification, index: number) => `cert:${entry.id || index}`;
const skillKey = (index: number) => `skill:${index}`;

const filled = (value: string | undefined): boolean => (value ?? '').trim().length > 0;

/** Said in full rather than left as a dash: the parse found a start and never found an end. */
const NO_END = 'no end date found';

const range = (start: string, end: string | undefined, current: boolean): string => {
  const from = formatMonthYear(start);
  const to = current ? 'Present' : filled(end) ? formatMonthYear(end ?? '') : NO_END;
  return from ? `${from} – ${to}` : to;
};

/**
 * Why a role is a guess rather than a reading. A resume writes "2022 –" for the job someone
 * still holds, and the extractor cannot tell that from a date it simply failed to read — so an
 * entry with no end date and no `current` flag is an assumption either way, and an assumption
 * must not be committed to the profile behind the reader's back.
 */
export function isLowConfidenceExperience(entry: Experience): string | undefined {
  if (!filled(entry.company) || !filled(entry.title)) return 'Missing details';
  if (!entry.current && !filled(entry.endDate)) return 'No end date found';
  return undefined;
}

/** The same rule, on the same evidence, for a course of study. */
export function isLowConfidenceEducation(entry: Education): string | undefined {
  if (!filled(entry.institution) || !filled(entry.degree)) return 'Missing details';
  if (!entry.current && !filled(entry.endDate)) return 'No end date found';
  return undefined;
}

const withWarning = (row: Omit<ImportRow, 'warning'>, warning: string | undefined): ImportRow =>
  warning ? { ...row, warning } : row;

const group = (key: ImportGroupKey, title: string, rows: ImportRow[]): ImportGroup[] =>
  rows.length > 0 ? [{ key, title, rows }] : [];

/** Every row the draft offers, in the order the page draws them. Empty groups are dropped. */
export function importGroups(draft: ProfileDraft | null): ImportGroup[] {
  if (!draft) return [];
  return [
    ...group(
      'headline',
      'HEADLINE',
      filled(draft.headline) ? [{ key: HEADLINE_KEY, title: draft.headline ?? '' }] : [],
    ),
    ...group(
      'experiences',
      'EXPERIENCE',
      (draft.experiences ?? []).map((entry, index) =>
        withWarning(
          {
            key: expKey(entry, index),
            title: filled(entry.title) ? entry.title : 'Untitled role',
            caption: [entry.company, range(entry.startDate, entry.endDate, entry.current)]
              .filter(filled)
              .join(' · '),
          },
          isLowConfidenceExperience(entry),
        ),
      ),
    ),
    ...group(
      'education',
      'EDUCATION',
      (draft.education ?? []).map((entry, index) =>
        withWarning(
          {
            key: eduKey(entry, index),
            title: filled(entry.degree) ? entry.degree : 'Course',
            caption: [entry.institution, range(entry.startDate, entry.endDate, entry.current)]
              .filter(filled)
              .join(' · '),
          },
          isLowConfidenceEducation(entry),
        ),
      ),
    ),
    ...group(
      'certifications',
      'CERTIFICATIONS',
      (draft.certifications ?? []).map((entry, index) => ({
        key: certKey(entry, index),
        title: entry.name,
        ...(filled(entry.issuer) ? { caption: entry.issuer } : {}),
      })),
    ),
    ...group(
      'skills',
      'SKILLS',
      (draft.skills ?? []).map((skill, index) => ({ key: skillKey(index), title: skill })),
    ),
  ];
}

/** Everything the parser is sure about starts accepted; everything it guessed starts off. */
export function initialAccepted(draft: ProfileDraft | null): Set<string> {
  const keys = importGroups(draft)
    .flatMap((entry) => entry.rows)
    .filter((row) => row.warning === undefined)
    .map((row) => row.key);
  return new Set(keys);
}

/** The draft narrowed to the rows still switched on — the only thing ever sent to the profile. */
export function acceptedDraft(draft: ProfileDraft, accepted: ReadonlySet<string>): ProfileDraft {
  const headline =
    filled(draft.headline) && accepted.has(HEADLINE_KEY) ? draft.headline : undefined;
  return {
    // Omitted rather than sent blank: `applyProfileDraft` keeps the existing headline when this
    // is undefined, and an empty string would overwrite it.
    ...(headline !== undefined ? { headline } : {}),
    skills: (draft.skills ?? []).filter((_, index) => accepted.has(skillKey(index))),
    experiences: (draft.experiences ?? []).filter((entry, index) =>
      accepted.has(expKey(entry, index)),
    ),
    education: (draft.education ?? []).filter((entry, index) => accepted.has(eduKey(entry, index))),
    certifications: (draft.certifications ?? []).filter((entry, index) =>
      accepted.has(certKey(entry, index)),
    ),
  };
}

/** What the bar says when every row is off: why the button is inert. */
export const NOTHING_ACCEPTED_NOTE = 'Nothing selected. Turn on a row to add it.';

const joinList = (parts: readonly string[]): string =>
  parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;

/**
 * "Adds 2 roles and 8 skills" — what pressing the primary will do, said BEFORE the press. Returns
 * null when nothing is selected; the caller shows `NOTHING_ACCEPTED_NOTE` in its place.
 */
export function addedSummary(draft: ProfileDraft): string | null {
  const experiences = draft.experiences ?? [];
  const education = draft.education ?? [];
  const certifications = draft.certifications ?? [];
  const skills = draft.skills ?? [];

  const parts = [
    filled(draft.headline) ? 'a headline' : '',
    experiences.length > 0 ? pluralize(experiences.length, 'role') : '',
    education.length > 0 ? pluralize(education.length, 'degree') : '',
    certifications.length > 0 ? pluralize(certifications.length, 'certification') : '',
    skills.length > 0 ? pluralize(skills.length, 'skill') : '',
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? `Adds ${joinList(parts)}` : null;
}
