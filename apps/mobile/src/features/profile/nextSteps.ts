/**
 * The completeness card's chips this build knows how to answer (PROFILE 01 1:2224, the fixture's
 * two). The ids are the data layer's: `profileRepo.updateSkills` drops the skills step itself.
 */
export const NEXT_STEP = {
  skills: 'step_skills',
  salary: 'step_salary',
} as const;

/**
 * What a chip's press does, said to a screen reader. A chip opens the editor that answers it and
 * the step leaves only once that data has been saved (§85); it used to tick itself off on the tap
 * alone, so "Add skills" went away with no skill added. A step this build does not know opens Edit
 * profile, the general way into the profile.
 */
export function nextStepHint(id: string): string {
  if (id === NEXT_STEP.skills) return 'Opens your skills';
  if (id === NEXT_STEP.salary) return 'Opens the minimum salary picker';
  return 'Opens Edit profile';
}
