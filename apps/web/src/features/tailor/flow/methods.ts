/**
 * The four ways to make the resume (W-FLOW "How would you like to create your resume?", owner
 * mockup 2026-11-02, toreview §151): each with its picture, its line and three short points.
 */
export type Method = 'tailor' | 'profile' | 'zero' | 'upload';

export const METHOD_ORDER: readonly Method[] = ['tailor', 'profile', 'zero', 'upload'];

export const METHOD_ART: Record<Method, string> = {
  tailor: '/illustrations/flow/profile.png',
  profile: '/illustrations/flow/build.png',
  zero: '/illustrations/flow/zero.png',
  upload: '/illustrations/flow/upload.png',
};

export const METHOD_TITLE: Record<Method, string> = {
  tailor: 'Tailor my selected resume',
  profile: 'Create from my profile',
  zero: 'Start from scratch with AI',
  upload: 'Upload a resume',
};

export const METHOD_POINTS: Record<Method, readonly string[]> = {
  tailor: [
    'Keep your existing experience',
    'Match job requirements',
    'Get improvement suggestions',
  ],
  profile: ['Reuse your profile data', 'Keep it up to date', 'Create future resumes faster'],
  zero: ['Quick and guided', 'AI-written first draft', 'You’re in full control'],
  upload: ['Use your own file', 'Extract and improve content', 'Customize for this role'],
};

/** Each card's line; the tailor one names the picked resume. */
export function methodLine(method: Method, resumeTitle: string | undefined): string {
  switch (method) {
    case 'tailor':
      return resumeTitle
        ? `Use “${resumeTitle}” as a base and tailor it to the job with AI.`
        : 'Use one of your resumes as a base and tailor it to the job with AI.';
    case 'profile':
      return 'Build a resume using your saved work experience, education, and skills.';
    case 'zero':
      return 'Answer three questions and we’ll write a first draft for you to review and edit.';
    case 'upload':
      return 'Upload an existing resume (PDF or DOCX) and we’ll tailor it to this job.';
  }
}
