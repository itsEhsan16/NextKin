import { EMPLOYMENT_TYPE_LABEL, type EmploymentType, type JdDraft } from '@nextkin/shared/models';

/**
 * The JD upload page (247:2 paste, 244:467 link, 247:453 file): its three ways in, the limits the
 * boards print, and the copy the side columns carry. The boards' own words throughout.
 */

/** The three ways in, in the boards' order. */
export const UPLOAD_TABS = ['file', 'link', 'paste'] as const;
export type UploadTab = (typeof UPLOAD_TABS)[number];

export const isUploadTab = (value: string): value is UploadTab =>
  (UPLOAD_TABS as readonly string[]).includes(value);

export const TAB_COPY: Record<UploadTab, { label: string; caption: string }> = {
  file: { label: 'Upload file', caption: 'PDF, DOC, DOCX, TXT (Max 5MB)' },
  link: { label: 'Paste from link', caption: 'LinkedIn, company careers page' },
  paste: { label: 'Paste text', caption: 'Copy and paste your JD' },
};

export const uploadTabId = (tab: UploadTab) => `upload-tab-${tab}`;
export const uploadPanelId = (tab: UploadTab) => `upload-panel-${tab}`;

/** The paste box's limit, from the board's "0/10,000". V2 §7.5 asks for a generous one. */
export const MAX_JD_CHARS = 10_000;

/**
 * The board's "Max 5MB", and its four formats. V2 §7.4 lists only PDF, DOCX and TXT; DOC is the
 * board's (`toreview.md` §23).
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt'];
export const FILE_ACCEPT = FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** Why a picked file can't be used, or `null` when it can. */
export function fileProblem(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  if (!FILE_EXTENSIONS.includes(ext)) {
    return 'That file type isn’t supported. Upload a PDF, DOC, DOCX or TXT file.';
  }
  if (file.size === 0) return 'That file is empty. Choose another one.';
  if (file.size > MAX_FILE_BYTES) return 'That file is over 5MB. Upload a smaller one.';
  return null;
}

export const isPdfName = (name: string) => /\.pdf$/i.test(name);

/** Why a pasted link can't be fetched, or `null` when it can: a full http(s) address. */
export function linkProblem(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')) {
      return null;
    }
  } catch {
    // Not a URL at all; falls through to the same message.
  }
  return 'Enter the full link to a job posting, starting with https://';
}

export const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[];

/** "found 6 skills: 4 required, 2 preferred", or a plain admission when there were none. */
export function skillSummary(draft: Pick<JdDraft, 'requiredSkills' | 'preferredSkills'>): string {
  const required = draft.requiredSkills.length;
  const preferred = draft.preferredSkills.length;
  const total = required + preferred;
  if (total === 0) return 'didn’t recognise any skills in it';
  return `found ${total} ${total === 1 ? 'skill' : 'skills'}: ${required} required, ${preferred} preferred`;
}

/**
 * A glyph in a benefit row. Each board draws its own four (`toreview.md` §27). The paste and file
 * columns share only the bar chart, which is one drawing on both boards.
 */
export type BenefitIcon =
  // The redrawn paste and upload boards' duotone glyphs (457:485-596), drawn on no disc.
  | 'artDocumentSearch'
  | 'artMatchScore'
  | 'artLightbulb'
  | 'artBookmark'
  // The redrawn link board's duotone glyphs (458:861-884), each on its lavender disc.
  | 'discBolt'
  | 'discDocumentSearch'
  | 'discGoals'
  | 'discLock';
export type Benefit = { icon: BenefitIcon; title: string; line: string };

/** "Paste the job description and NextKin will:" (247:178), with its duotone glyphs (361:1264). */
export const PASTE_BENEFITS: readonly Benefit[] = [
  {
    icon: 'artDocumentSearch',
    title: 'Extract key details',
    line: 'Identify skills, qualifications, and responsibilities.',
  },
  {
    icon: 'artMatchScore',
    title: 'Show your match score',
    line: 'See how well your profile fits this role.',
  },
  {
    icon: 'artLightbulb',
    title: 'Give personalized suggestions',
    line: 'Get tailored resume, cover letter, and interview tips.',
  },
  { icon: 'artBookmark', title: 'Save it to your jobs', line: 'Keep track and revisit anytime.' },
];

/**
 * The upload board's version of the same four (247:646-677), in its own words and with its own
 * glyphs (261:1127-1143).
 */
export const FILE_BENEFITS: readonly Benefit[] = [
  {
    icon: 'artDocumentSearch',
    title: 'Extract key details',
    line: 'Identify skills, qualifications, and responsibilities.',
  },
  {
    icon: 'artMatchScore',
    title: 'Show your match score',
    line: 'See how well your profile fits this role.',
  },
  {
    icon: 'artLightbulb',
    title: 'Get personalized suggestions',
    line: 'Tailored resume, cover letter, and interview tips.',
  },
  {
    icon: 'artBookmark',
    title: 'Save and track',
    line: 'Keep your jobs organized in one place.',
  },
];

/** "Why use a job link?" (244:661), with the glyphs the board now draws (261:673-686). */
export const LINK_REASONS: readonly Benefit[] = [
  {
    icon: 'discBolt',
    title: 'Saves time',
    line: 'We extract the full job description automatically.',
  },
  {
    icon: 'discDocumentSearch',
    title: 'More accurate',
    line: 'Gets the latest and complete job details.',
  },
  {
    icon: 'discGoals',
    title: 'Better insights',
    line: 'More context = more personalized recommendations.',
  },
  {
    icon: 'discLock',
    title: 'Secure & private',
    line: 'We only use the link to fetch the job details.',
  },
];

export type SourceName =
  'linkedin' | 'indeed' | 'glassdoor' | 'wellfound' | 'google' | 'microsoft' | 'amazon';

/** "Supported links" under the link field (244:617). */
export const SUPPORTED_LINKS: readonly { name: SourceName; label: string }[] = [
  { name: 'linkedin', label: 'LinkedIn' },
  { name: 'indeed', label: 'Indeed' },
  { name: 'glassdoor', label: 'Glassdoor' },
  { name: 'wellfound', label: 'Wellfound' },
];

/** "Popular sources" in the link column (244:698). */
export const POPULAR_SOURCES: readonly { name: SourceName; label: string }[] = [
  ...SUPPORTED_LINKS,
  { name: 'google', label: 'Google Careers' },
  { name: 'microsoft', label: 'Microsoft' },
  { name: 'amazon', label: 'Amazon' },
];

/**
 * "Use sample JD" (247:684) fills the paste box with this. It's the upload board's own example
 * (Senior Product Designer, Google, Bengaluru) written out, with the stated must-have split the
 * extractor reads.
 */
export const SAMPLE_JD = [
  'Senior Product Designer at Google',
  'Company — Google',
  'Location — Bengaluru, India (Hybrid)',
  '',
  "You'll lead design for merchant tools used by millions of businesses, working with product, engineering and research.",
  '',
  'What you will do',
  '- Own interaction design end to end, from user flows and wireframing to prototyping',
  '- Plan and run user research and usability testing with merchants',
  '- Extend our design systems and design tokens',
  '',
  'Must have',
  '- 6+ years designing digital products, with expert Figma craft',
  '- Experience with information architecture and stakeholder management',
  '',
  'Nice to have',
  '- Accessibility and WCAG know-how',
  '- Comfort with analytics and A/B testing',
].join('\n');
