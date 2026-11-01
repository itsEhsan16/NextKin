import { parsePartialDate, type PartialDate } from '@nextkin/engines/dates';
import { detectGaps, type Gap } from '@nextkin/engines/gaps';

import type { Education, Experience, GapAnswer, GapQuestion, Profile } from '../models/profile';

/**
 * The gap interview's questions (toreview §146.7): the engine decides what to ask, and these are its
 * words and what an answer does. Shared, so the mock and the server ask the same things and write
 * the same facts. Asked and answered or skipped is remembered by question, so nothing nags.
 */

/** No more than this at a sitting. */
export const MAX_GAP_QUESTIONS = 7;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (date: PartialDate) => `${MONTHS[(date.month ?? 1) - 1]} ${date.year}`;
const stamp = (date: PartialDate) => `${date.year}-${String(date.month ?? 1).padStart(2, '0')}`;

function questionOf(gap: Gap, profile: Profile): GapQuestion | null {
  const roleOf = (id: string) => profile.experiences.find((r) => r.id === id);
  switch (gap.kind) {
    case 'role_end': {
      const role = roleOf(gap.roleId);
      if (!role) return null;
      return {
        id: `role_end:${role.id}`,
        kind: 'role_end',
        title: `Are you still at ${role.company}?`,
        detail: `Your ${role.title} role has no end date.`,
        roleId: role.id,
      };
    }
    case 'role_skills': {
      const role = roleOf(gap.roleId);
      if (!role) return null;
      return {
        id: `role_skills:${role.id}`,
        kind: 'role_skills',
        title: `What did you mainly use at ${role.company}?`,
        detail: 'A skill counts in full once a role shows it.',
        roleId: role.id,
        suggestions: profile.skills.slice(0, 8),
      };
    }
    case 'education_year': {
      const school = profile.education.find((e) => e.id === gap.educationId);
      if (!school) return null;
      return {
        id: `education_year:${school.id}`,
        kind: 'education_year',
        title: `What year did you finish at ${school.institution}?`,
        detail: `Your ${school.degree} has no end date.`,
        educationId: school.id,
      };
    }
    case 'date_gap':
      return {
        id: `date_gap:${stamp(gap.from)}:${stamp(gap.to)}`,
        kind: 'date_gap',
        title: `What were you doing from ${monthYear(gap.from)} to ${monthYear(gap.to)}?`,
        detail: 'There’s a gap between your roles. This stays off your resume.',
      };
    case 'skill_home':
      return {
        id: `skill_home:${gap.skill.trim().toLowerCase()}`,
        kind: 'skill_home',
        title: `You list ${gap.skill}, but no role shows it. Where did you use it?`,
        detail: 'A skill counts in full once a role shows it.',
        skill: gap.skill,
        roles: profile.experiences.map((r) => ({ id: r.id, label: `${r.title} at ${r.company}` })),
      };
  }
}

/** What's left to ask: the engine's findings, less what has been answered or skipped. */
export function gapQuestionsOf(profile: Profile, answered: Readonly<Record<string, string>>): GapQuestion[] {
  const gaps = detectGaps({
    roles: profile.experiences.map((r) => ({
      id: r.id,
      company: r.company,
      start: parsePartialDate(r.startDate),
      end: parsePartialDate(r.endDate),
      current: r.current,
      skills: r.skills,
    })),
    skills: profile.skills,
    education: profile.education.map((e) => ({ id: e.id, end: parsePartialDate(e.endDate), current: e.current })),
  });
  return gaps
    .flatMap((gap) => questionOf(gap, profile) ?? [])
    .filter((question) => answered[question.id] === undefined)
    .slice(0, MAX_GAP_QUESTIONS);
}

/** The rows an answer changes. A skip, a gap's reason or "a course" change none. */
export function gapChanges(profile: Profile, question: GapQuestion, answer: GapAnswer): { experience?: Experience; education?: Education } {
  const role = profile.experiences.find((r) => r.id === (answer.kind === 'skill_home' ? answer.roleId : question.roleId));
  if (answer.kind === 'role_end' && role) {
    const { endDate: _unknown, ...rest } = role;
    return { experience: answer.end === null ? { ...rest, current: true } : { ...rest, current: false, endDate: answer.end } };
  }
  if (answer.kind === 'role_skills' && role) {
    return { experience: { ...role, skills: [...new Set([...role.skills, ...answer.skills])] } };
  }
  if (answer.kind === 'skill_home' && role && question.skill) {
    return { experience: { ...role, skills: [...new Set([...role.skills, question.skill])] } };
  }
  if (answer.kind === 'education_year') {
    const school = profile.education.find((e) => e.id === question.educationId);
    if (school) return { education: { ...school, current: false, endDate: `${answer.year}-12-31`, endPrecision: 'year' } };
  }
  return {};
}

/** What's kept against a question once it's dealt with. */
export const gapRecord = (answer: GapAnswer): string => (answer.kind === 'date_gap' ? answer.reason : answer.kind === 'skip' ? 'skip' : 'answered');
