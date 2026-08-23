import type { PlaceholderKey } from '@/features/placeholders';

/**
 * Rows of the create sheet, transcribed from Figma CREATE 01 (1:1044) and CREATE 02 (1:1208).
 *
 * Canvas note 1:1365: "Row 5 ("Add a job manually") stays out until the V2 tracker ships.
 * Max 5 rows ever." — MAX_ROWS enforces that ceiling so the sheet height stays bounded.
 */
export const MAX_ROWS = 5;

export type CreateAction =
  /** Pushes to step 2 rather than navigating away. */
  | 'new-resume'
  | PlaceholderKey;

export type CreateRow = {
  key: CreateAction;
  /** FontAwesome 5 Free Solid glyph. */
  icon: string;
  label: string;
  description: string;
  ai?: boolean;
  tone?: 'neutral' | 'brand';
};

/** CREATE 01 — the "+" sheet. */
export const CREATE_ROOT_ROWS: readonly CreateRow[] = [
  {
    key: 'new-resume',
    icon: 'file-alt',
    label: 'New Resume',
    description: 'Start fresh or import your existing resume',
  },
  {
    key: 'tailor-to-a-job',
    icon: 'magic',
    label: 'Tailor to a Job',
    description: 'Adapt your base resume to a job description',
    ai: true,
    tone: 'brand',
  },
  {
    key: 'cover-letter',
    icon: 'envelope',
    label: 'Cover Letter',
    description: 'Written from your resume and the job posting',
    ai: true,
    tone: 'brand',
  },
  {
    key: 'ats-check',
    icon: 'tasks',
    label: 'ATS Check',
    description: 'Score any resume against ATS rules',
  },
];

/** CREATE 02 — the "New resume" trio, pushed inside the same sheet. */
export const CREATE_RESUME_ROWS: readonly CreateRow[] = [
  {
    key: 'upload-resume',
    icon: 'upload',
    label: 'Upload PDF or DOCX',
    description: "We'll parse your experience automatically",
  },
  {
    key: 'import-linkedin',
    icon: 'link',
    label: 'Import from LinkedIn',
    description: 'Pull your profile in one tap',
  },
  {
    key: 'start-from-scratch',
    icon: 'edit',
    label: 'Start from scratch',
    description: 'Build it section by section',
  },
];

/** Footnote under the CREATE 02 rows (Figma 1:1351). */
export const CREATE_RESUME_FOOTNOTE =
  'Content first — you pick a template after your resume has something in it.';
