import { useCurrentUser, useProfile } from '@nextkin/shared/queries';

import { bandForYears } from './onboardingOptions';
import { useOnboardingStore } from './onboardingStore';
import { mostRecent } from './roles';
import { initialsOf, startingSummary } from './startingPoint';

/**
 * What ONB 08 shows, from this visit's answers first and the saved profile behind them, so a
 * reload on the last page still has something true to say. Loading is reported only while there
 * is neither.
 */
export function useStartingPoint() {
  const user = useCurrentUser();
  const profile = useProfile();
  const answers = useOnboardingStore();
  const saved = profile.data;
  const latestRole = saved ? mostRecent(saved.experiences) : undefined;
  const role = answers.noWork ? undefined : answers.roles?.[0];

  const name =
    answers.name?.trim() ||
    (user.data ? `${user.data.firstName} ${user.data.lastName}`.trim() : '');
  const title = role?.title || answers.jobTitle || saved?.headline || latestRole?.title;
  const company = answers.noWork ? undefined : role?.company || latestRole?.company;
  const band =
    answers.experience ?? saved?.preferences.experienceBand ?? bandForYears(saved?.yearsExperience);
  const goal = answers.goal ?? saved?.preferences.careerGoal;
  const targetRole = answers.targetRole?.trim() || saved?.preferences.desiredRoles[0];
  const skills = answers.skills ?? saved?.skills ?? [];

  return {
    loading: !name && (user.isPending || profile.isPending),
    name,
    firstName: name.split(/\s+/)[0] ?? '',
    initials: initialsOf(name),
    headline:
      title && targetRole
        ? `${title} → aiming for ${targetRole}`
        : (title ?? (targetRole ? `Aiming for ${targetRole}` : '')),
    summary: startingSummary({ title, band, company, skills, goal, targetRole }),
    skills,
  };
}
