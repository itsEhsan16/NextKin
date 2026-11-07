import { useFirstResume } from './hooks/useFirstResume';

/**
 * The after-sign-up redirect to "Add your resume", mounted in the tabs layout. It draws nothing:
 * since §187 Home never asks for a resume itself.
 */
export function FirstResumeHost() {
  useFirstResume();
  return null;
}
