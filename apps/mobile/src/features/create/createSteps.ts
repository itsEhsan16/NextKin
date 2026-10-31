import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import AtsCheckIcon from '../../../assets/icons/create/ats-check.svg';
import LinkedInIcon from '../../../assets/icons/create/linkedin.svg';
import NewResumeIcon from '../../../assets/icons/create/new-resume.svg';
import ScratchIcon from '../../../assets/icons/create/scratch.svg';
import TailorIcon from '../../../assets/icons/create/tailor.svg';
import UploadIcon from '../../../assets/icons/create/upload.svg';

/**
 * Rows of the create sheet, transcribed from Figma CREATE 01 (1:1044) and CREATE 02 (1:1208).
 *
 * Canvas note 1:1365: "Row 5 ("Add a job manually") stays out until the V2 tracker ships.
 * Max 5 rows ever." — MAX_ROWS enforces that ceiling so the sheet height stays bounded.
 */
export const MAX_ROWS = 5;

/**
 * What a row does, enumerated rather than derived from the placeholder registry.
 *
 * It used to be Extract<PlaceholderKey, ...>, which worked only while every row led somewhere
 * undesigned. Every row has a real screen now (Phases 9B and 9D), and CREATE_ROUTES in the
 * sheet host is a total map over this union — so adding a row without a destination stops
 * compiling rather than shipping a dead tap.
 */
export type CreateAction =
  /** Pushes to step 2 rather than navigating away. */
  | 'new-resume'
  | 'tailor-to-a-job'
  | 'cover-letter'
  | 'ats-check'
  | 'upload-resume'
  | 'import-linkedin'
  | 'start-from-scratch';

export type CreateRow = {
  key: CreateAction;
  /**
   * The row's own multi-tone icon, tile included (Figma 431:7772 … 431:7883). `w`/`h` are its
   * drawn box over 0.75 — the seven are not all square, and none is stretched to match.
   */
  art: { Icon: FC<SvgProps>; w: number; h: number };
  label: string;
  description: string;
  ai?: boolean;
};

/**
 * CREATE 01 — the "+" sheet. Three rows since the owner's one-flow decision (toreview §114): a
 * resume for a job, a check of the one you have, a new one. Cover letters stay on Home's quick
 * start and after a run.
 */
export const CREATE_ROOT_ROWS: readonly CreateRow[] = [
  {
    key: 'tailor-to-a-job',
    art: { Icon: TailorIcon, w: 52, h: 51.9935 },
    label: 'Make a resume for a job',
    description: 'Pick a job and get your resume made for it',
    ai: true,
  },
  {
    key: 'ats-check',
    art: { Icon: AtsCheckIcon, w: 52, h: 50.6705 },
    label: 'Check my resume',
    description: 'Score your resume against a job',
  },
  {
    key: 'new-resume',
    art: { Icon: NewResumeIcon, w: 52, h: 51.876 },
    label: 'New resume',
    description: 'Start fresh or import your existing resume',
  },
];

/** CREATE 02 — the "New resume" trio, pushed inside the same sheet. */
export const CREATE_RESUME_ROWS: readonly CreateRow[] = [
  {
    key: 'upload-resume',
    art: { Icon: UploadIcon, w: 52, h: 53.946 },
    label: 'Upload PDF or DOCX',
    description: "We'll parse your experience automatically",
  },
  {
    key: 'import-linkedin',
    art: { Icon: LinkedInIcon, w: 50.654, h: 55.4667 },
    label: 'Import from LinkedIn',
    description: 'Pull your profile in one tap',
  },
  {
    key: 'start-from-scratch',
    art: { Icon: ScratchIcon, w: 52, h: 54.272 },
    label: 'Start from scratch',
    description: 'Build it section by section',
  },
];

/** Footnote under the CREATE 02 rows (Figma 1:1351). */
export const CREATE_RESUME_FOOTNOTE =
  'Content first — you pick a template after your resume has something in it.';
