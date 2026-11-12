import type { AssistantAttachment, CareerDocument, Job, Resume } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import {
  NavInterviewPrepIllustration,
  ProfileExperienceIllustration,
  ProfileInsightsIllustration,
  AssistantTermsIllustration,
} from '@/ui/illustrations';

/** The composer's cap (768:125's "0 / 500"), the same as mobile's. */
export const MESSAGE_MAX = 500;

export type Starter = {
  key: string;
  label: string;
  /** What the composer is filled with: a question to finish, not one sent for the user. */
  draft: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * The welcome's four topics (768:10), each with the board's duotone art. A topic starts a
 * question in the composer rather than sending one, so the user says what they actually want to
 * know (`toreview.md` §96).
 */
export const STARTERS: readonly Starter[] = [
  {
    key: 'jobs',
    label: 'My job search',
    draft: 'Help me with my job search: ',
    Art: ProfileExperienceIllustration,
  },
  {
    key: 'documents',
    label: 'Resumes & cover letters',
    draft: 'A question about my resume: ',
    Art: AssistantTermsIllustration,
  },
  {
    key: 'ats',
    label: 'ATS scores',
    draft: 'About my ATS score: ',
    Art: ProfileInsightsIllustration,
  },
  {
    key: 'interview',
    label: 'Interview prep',
    draft: 'Help me prepare for an interview: ',
    Art: NavInterviewPrepIllustration,
  },
];

/**
 * "Try asking" (771:32), in the boards' words. Mobile's list spells "ATS-optimised"; the web
 * boards write "optimized", the spelling the rest of the web app uses.
 */
export const PROMPTS: readonly string[] = [
  'Why is my ATS score what it is?',
  'How do I explain a career gap?',
  'What does "ATS-optimized" actually mean?',
  'How should I answer "tell me about yourself"?',
];

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * A resume's row in the attach flyout (772:421): "Base resume · ATS 92", "For Google · ATS 92".
 * The base is `isBase`: the server marks every untailored resume `variant: 'default'`, so the
 * variant alone would call them all the base.
 */
export function resumeLine(resume: Resume, company: string | undefined): string {
  const lead = resume.isBase ? 'Base resume' : company ? `For ${company}` : 'Tailored';
  return resume.atsScore == null ? lead : `${lead} · ATS ${resume.atsScore}`;
}

export const resumeAttachment = (resume: Resume): AssistantAttachment => ({
  kind: 'resume',
  id: resume.id,
  title: resume.title,
  detail: `Resume on NextKin · ${plural(resume.pageCount ?? 1, 'page')}`,
});

export const documentAttachment = (document: CareerDocument): AssistantAttachment => ({
  kind: 'cover_letter',
  id: document.id,
  title: document.title,
  detail: 'Cover letter',
});

export const jobAttachment = (job: Job): AssistantAttachment => ({
  kind: 'job',
  id: job.id,
  title: `${job.company} — ${job.title}`,
  detail: 'Job on NextKin',
});

/** The file kinds the upload option takes (772:355): PDF or DOCX. */
export const FILE_ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const fileAttachment = (file: File): AssistantAttachment => ({
  kind: 'file',
  id: file.name,
  title: file.name,
  detail: file.name.toLowerCase().endsWith('.pdf')
    ? 'PDF from your computer'
    : 'DOCX from your computer',
});

/** Whether a picked file is one the upload option takes. */
export const isAcceptedFile = (file: File): boolean => /\.(pdf|docx)$/i.test(file.name);
