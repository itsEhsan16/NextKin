import type { CareerDocument } from '../../models';

import { daysAgo } from './time';

/**
 * The Documents board's library (Figma 286:2026). The seven rows it draws come first, newest first,
 * with its sizes and ages. Five older ones make up its "All Documents (12)" and the pills' split:
 * Certificates 4, Cover Letters 3, ID Proofs 2 and Other 3. Other is every kind without a pill of
 * its own, which is how the board's "Resume - Product Designer" counts. The two older letters go
 * to companies George applied to on the Applications board, a few days before he applied.
 *
 * Only the certificate the board opens, and the Google cover letter the web viewer opens (563:1377),
 * carry what they say; the rest are files the card can't draw. The photo is the one image, and it is George's own avatar.
 */
type Seed = Omit<CareerDocument, 'createdAt' | 'updatedAt'> & { updatedDaysAgo: number };

/* prettier-ignore */
const SEEDS: Seed[] = [
  {
    id: 'doc_swe_certificate', title: 'Software Engineer Certificate', kind: 'certificate', format: 'pdf', sizeBytes: 2_400_000, updatedDaysAgo: 2,
    // 286:2251, verbatim. Noon, so the date reads the same in every timezone.
    certificate: { issuer: 'Google Career Certificates', issuerLogoUrl: 'asset:logo-google', title: 'Software Engineering', recipient: 'George Smith', statement: 'has successfully completed the Google Software Engineering Professional Certificate, demonstrating proficiency in modern software development practices.', completedAt: '2024-03-15T12:00:00.000Z', signer: { name: 'Thomas Kurian', role: 'CEO, Google Cloud', signatureUrl: 'asset:signature-kurian' } },
  },
  {
    id: 'doc_cover_google', title: 'Cover Letter - Google', kind: 'cover_letter', format: 'docx', sizeBytes: 245_000, updatedDaysAgo: 8,
    // 563:1722, verbatim: the letter the web viewer sets as a page.
    coverLetter: {
      senderHeadline: 'Software Engineer',
      company: 'Google',
      companyLogoUrl: 'asset:logo-google',
      location: 'Bengaluru, India',
      role: 'Lead UX Designer',
      jobRef: 'GOO-UX-10234',
      salutation: 'Dear Hiring Manager,',
      paragraphs: [
        'I am writing to apply for the Lead UX Designer role at Google. I have spent 4+ years shipping web products at Google and Adobe, and I am now moving into product design.',
        'At Google, where I have been a Software Engineer since January 2022, I build and maintain web applications used by millions of users, and I improved application performance, reducing load time by 40%. Before that, at Adobe, I developed internal tools to streamline workflows and received the “Impact Award” for contributing to a key product launch.',
        'I prototype quickly, work side by side with designers and product managers, and care about the details users feel. I would welcome the chance to talk about how I could help your team.',
      ],
      signOff: 'Sincerely,',
    },
  },
  { id: 'doc_passport', title: 'Passport', kind: 'id_proof', format: 'pdf', sizeBytes: 1_100_000, updatedDaysAgo: 15 },
  { id: 'doc_portfolio_links', title: 'Portfolio Links', kind: 'other', format: 'xlsx', sizeBytes: 18_000, updatedDaysAgo: 17 },
  { id: 'doc_resume_pd', title: 'Resume - Product Designer', kind: 'resume', format: 'docx', sizeBytes: 320_000, updatedDaysAgo: 22 },
  // 36 and 40 days: "1 month ago" needs five full weeks (`formatCoarseAge`).
  { id: 'doc_transcript', title: 'Academic Transcript', kind: 'certificate', format: 'pdf', sizeBytes: 1_800_000, updatedDaysAgo: 36 },
  { id: 'doc_profile_photo', title: 'Profile Photo', kind: 'other', format: 'jpg', sizeBytes: 420_000, updatedDaysAgo: 40, imageUrl: 'asset:avatar-george' },
  { id: 'doc_aws_certificate', title: 'AWS Cloud Practitioner Certificate', kind: 'certificate', format: 'pdf', sizeBytes: 1_300_000, updatedDaysAgo: 48 },
  { id: 'doc_cover_cred', title: 'Cover Letter - CRED', kind: 'cover_letter', format: 'docx', sizeBytes: 231_000, updatedDaysAgo: 52 },
  { id: 'doc_cover_zoho', title: 'Cover Letter - Zoho', kind: 'cover_letter', format: 'docx', sizeBytes: 238_000, updatedDaysAgo: 66 },
  { id: 'doc_aadhaar', title: 'Aadhaar Card', kind: 'id_proof', format: 'pdf', sizeBytes: 640_000, updatedDaysAgo: 95 },
  { id: 'doc_meta_certificate', title: 'Meta Front-End Developer Certificate', kind: 'certificate', format: 'pdf', sizeBytes: 980_000, updatedDaysAgo: 120 },
];

export const documentsFixture: CareerDocument[] = SEEDS.map(({ updatedDaysAgo, ...document }) => ({
  ...document,
  createdAt: daysAgo(updatedDaysAgo + 3),
  updatedAt: daysAgo(updatedDaysAgo),
}));
