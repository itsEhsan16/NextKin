/**
 * A resume as the LaTeX template sets it (toreview §111): the uploaded resume's own structure, in
 * its own order, already decided by code. Every string here is plain user text; the generator
 * escapes all of it (`escape.ts`) and no field is ever passed to TeX as markup.
 *
 * Mapped from the canonical resume JSON by `fromCanonical.ts`; nothing here knows about claims.
 */

/** One piece of the contact line, in the file's order: "Muzaffarpur, Bihar, India", a link. */
export interface LatexContactItem {
  text: string;
  /** https:, mailto: or tel: only; anything else is printed as text without a link. */
  url?: string;
}

/**
 * One entry: a role, a client project inside a role, a project, a school, an activity.
 *  - title row: `title` (bold) + `titleNote` (normal, e.g. "(webcros.in)"), `right` flush right
 *    (dates);
 *  - subtitle row: `subtitle` (bold for a job title) + `subRight` flush right (place);
 *  - `tech`: its own line or, for an inline-tech title, " | tech" after the title;
 *  - bullets, then nested `children` (a role's client projects), each one level in.
 */
export interface LatexEntry {
  title: string;
  titleNote?: string;
  right?: string;
  subtitle?: string;
  /** A job title: set bold, like the employer above it (toreview §130). */
  subtitleBold?: boolean;
  subRight?: string;
  tech?: string;
  /** Where `tech` goes: after the title on one line ("iRedirectX | React, SQL"), or its own line. */
  techInline?: boolean;
  bullets: string[];
  children?: LatexEntry[];
}

export type LatexSection =
  /** A summary: one paragraph. */
  | { kind: 'paragraph'; heading: string; text: string }
  /** Labelled lines ("Front End: React, Next.js") or plain lines (certifications), as a list. */
  | { kind: 'lines'; heading: string; lines: { label?: string; text: string }[] }
  | { kind: 'entries'; heading: string; entries: LatexEntry[] };

/** Tighter steps the page fit may take, in order: font size, margins, spacing. */
export type LatexDensity = 0 | 1 | 2;

export interface LatexResume {
  name: string;
  /** A line under the name, when the resume has one. */
  headline?: string;
  contact: LatexContactItem[];
  /** In the resume's own order, with its own heading wording. */
  sections: LatexSection[];
  density: LatexDensity;
  paper: 'letter' | 'a4';
}

/** What the compile service answers (`POST /compile`, body: the .tex source). */
export interface CompileResult {
  pdf: Uint8Array;
  pages: number;
  /** One PNG per page at the preview resolution, page 1 first. */
  pngs: Uint8Array[];
  /** Milliseconds the compile took, for the log and the limits. */
  ms: number;
}
