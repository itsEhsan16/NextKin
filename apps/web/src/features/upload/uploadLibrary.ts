/**
 * The limits and checks of the job box in the create flows' first step (`OtherJobBox`): what a
 * pasted description, a link or a file may be. The standalone Upload a JD page went (owner,
 * 2026-11-12, toreview §203); its box lives on in that step.
 */

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

/** Whether a pasted text is a single link rather than a description. */
export const looksLikeLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/**
 * "Try a sample job" fills the job box with this. It's the upload board's own example
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
