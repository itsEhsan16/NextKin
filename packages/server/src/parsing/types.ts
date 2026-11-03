import type { FileLayout } from './layout';
/**
 * What the upload analyzer reports (ImBackendImplementationPlan P7-04, Q-05). `text` is the only
 * field anything downstream reads — extraction, the teaser, a model. Hidden runs are listed for the
 * user and go nowhere else (G9).
 */

export type FileKind = 'pdf' | 'docx' | 'doc' | 'txt' | 'png' | 'jpeg' | 'webp' | 'unknown';

export interface HiddenRun {
  page: number;
  text: string;
  reason: 'invisible' | 'background' | 'tiny' | 'off_page' | 'hidden_run' | 'zero_width';
}

export interface PageImage {
  page: number;
  width: number;
  height: number;
  /** pdfjs image kind: 1 = 1-bit grayscale, 2 = RGB, 3 = RGBA. */
  kind: number;
  data: Uint8Array;
  /** Area on the page, in square points. */
  area: number;
}

export interface Analysis {
  kind: FileKind;
  /** The visible text only. */
  text: string;
  hidden: HiddenRun[];
  facts: {
    pages: number;
    /** Visible, non-space characters. */
    chars: number;
    /** Pages whose text yield fell under the OCR threshold. */
    lowTextPages: number[];
    ocr: boolean;
    /** How a document is laid out, measured from the file (`layout.ts`); absent for images. */
    layout?: FileLayout;
  };
  /** The file's links with the text they cover, for the header (PDF only). */
  links?: { text: string; url: string }[];
  /** Page images to OCR, when the text yield says the document is a scan. */
  images: PageImage[];
}

/** Refusals the user can act on, mapped onto UNREADABLE_FILE. */
export class UnreadableError extends Error {
  constructor(
    readonly code: 'unsupported_type' | 'type_mismatch' | 'too_large' | 'zip_bomb' | 'dtd_refused' | 'encrypted' | 'corrupt' | 'no_text' | 'timeout',
    message: string,
  ) {
    super(message);
    this.name = 'UnreadableError';
  }
}
