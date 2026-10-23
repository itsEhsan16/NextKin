/**
 * The career documents a candidate keeps beside their resumes (Figma 286:2026, web): certificates,
 * cover letters, ID proofs and whatever else an application asks for. V2 names no such store, so
 * the board alone defines it (`toreview.md` §19). These are files the candidate brought; the
 * structured resumes NextKin writes live in `Resume`.
 */
export type CareerDocumentKind = 'certificate' | 'cover_letter' | 'id_proof' | 'resume' | 'other';

/** The file's format, which its tile names ("PDF", "DOCX"…). */
export type CareerDocumentFormat = 'pdf' | 'docx' | 'xlsx' | 'jpg';

/** What a certificate says, so the detail card can draw it (286:2251) instead of an opaque file. */
export type CertificateDetails = {
  issuer: string;
  /** An `asset:` key or URL, as on `Job.companyLogoUrl`. */
  issuerLogoUrl?: string;
  /** The credential itself: "Software Engineering". */
  title: string;
  recipient: string;
  statement: string;
  /** ISO-8601 */
  completedAt: string;
  signer?: { name: string; role: string; signatureUrl?: string };
};

/**
 * What a cover letter says, so the web viewer can set it as a page (563:1722) instead of an opaque
 * file. The sender's contact lines are the account's own; the letter keeps only the headline it
 * was written under, which can differ from the profile's.
 */
export type CoverLetterDetails = {
  /** "Software Engineer": the line under the sender's name. */
  senderHeadline: string;
  company: string;
  /** An `asset:` key or URL, as on `Job.companyLogoUrl`. */
  companyLogoUrl?: string;
  /** "Bengaluru, India". */
  location: string;
  role: string;
  /** The posting's own reference: "GOO-UX-10234". */
  jobRef?: string;
  salutation: string;
  paragraphs: string[];
  signOff: string;
};

export type CareerDocument = {
  id: string;
  title: string;
  kind: CareerDocumentKind;
  format: CareerDocumentFormat;
  sizeBytes: number;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
  certificate?: CertificateDetails;
  coverLetter?: CoverLetterDetails;
  /** An image file's own picture, an `asset:` key or URL, so the card can show it. */
  imageUrl?: string;
};
