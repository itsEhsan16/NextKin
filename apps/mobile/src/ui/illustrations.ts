/**
 * The redesign's 3D illustrations (toreview §172–176): soft clay in the brand's lavender and
 * indigo, generated with GPT Image 2.6 at medium and kept at 640px WebP. Referred to by name so a
 * screen never reaches into the assets folder itself.
 */
export const ILLUSTRATIONS = {
  emptyResume: require('../../assets/illustrations/redesign/empty-resume.webp'),
  jobMatch: require('../../assets/illustrations/redesign/job-match.webp'),
  resumeReady: require('../../assets/illustrations/redesign/resume-ready.webp'),
  noJobs: require('../../assets/illustrations/redesign/no-jobs.webp'),
  noResumes: require('../../assets/illustrations/redesign/no-resumes.webp'),
  noNotifications: require('../../assets/illustrations/redesign/no-notifications.webp'),
  noHistory: require('../../assets/illustrations/redesign/no-history.webp'),
  interview: require('../../assets/illustrations/redesign/interview.webp'),
  assistant: require('../../assets/illustrations/redesign/assistant.webp'),
  pro: require('../../assets/illustrations/redesign/pro.webp'),
  help: require('../../assets/illustrations/redesign/help.webp'),
  offline: require('../../assets/illustrations/redesign/offline.webp'),
  allDone: require('../../assets/illustrations/redesign/all-done.webp'),
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
