import type { Experience } from '@nextkin/shared/models';

import { endOfMonth, monthOf, startOfMonth } from './months';
import type { RoleAnswer } from './onboardingStore';

/** A role not yet on the profile. Not a UUID, so the API creates it rather than updating. */
export function emptyRole(): RoleAnswer {
  return {
    id: `exp_new_${Math.random().toString(36).slice(2, 10)}`,
    title: '',
    company: '',
    from: null,
    to: null,
    skills: [],
  };
}

/** The role a profile entry describes. */
export function roleFromExperience(entry: Experience): RoleAnswer {
  return {
    id: entry.id,
    title: entry.title,
    company: entry.company,
    from: monthOf(entry.startDate),
    to: entry.current ? 'present' : entry.endDate ? monthOf(entry.endDate) : null,
    skills: entry.skills,
  };
}

/** The most recent role: one still held, else the latest start. */
export function mostRecent(entries: readonly Experience[]): Experience | undefined {
  return [...entries].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return b.startDate.localeCompare(a.startDate);
  })[0];
}

export const roleComplete = (role: RoleAnswer) =>
  role.title.trim() !== '' && role.company.trim() !== '' && role.from != null && role.to != null;

export function experienceFromRole(role: RoleAnswer): Experience | null {
  if (!roleComplete(role) || role.from == null || role.to == null) return null;
  const current = role.to === 'present';
  return {
    id: role.id,
    title: role.title.trim(),
    company: role.company.trim(),
    startDate: startOfMonth(role.from),
    ...(current ? {} : { endDate: endOfMonth(role.to) }),
    current,
    skills: role.skills,
  };
}

/** Whether saving the role would change what the profile already holds. */
export function roleChanged(role: RoleAnswer, existing: Experience | undefined): boolean {
  if (!existing) return true;
  const before = roleFromExperience(existing);
  return (
    before.title !== role.title.trim() ||
    before.company !== role.company.trim() ||
    before.from !== role.from ||
    before.to !== role.to
  );
}
