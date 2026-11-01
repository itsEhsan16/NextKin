/**
 * The gap detector (toreview §146.7). Code decides what the interview asks: each finding is a hole
 * in the profile a person can fill with a short answer, and nothing here invents the answer. Pure:
 * no clock and no text, so the words are the caller's.
 */

import { monthIndex, type PartialDate } from './dates';

export interface GapRole {
  id: string;
  company: string;
  start: PartialDate | null;
  /** Null: no end date. Read with `current`. */
  end: PartialDate | null;
  current: boolean;
  skills: readonly string[];
}

export interface GapEducation {
  id: string;
  end: PartialDate | null;
  current: boolean;
}

export interface GapInput {
  roles: readonly GapRole[];
  skills: readonly string[];
  education: readonly GapEducation[];
}

export type Gap =
  | { kind: 'role_end'; roleId: string }
  | { kind: 'role_skills'; roleId: string }
  | { kind: 'education_year'; educationId: string }
  | { kind: 'date_gap'; from: PartialDate; to: PartialDate }
  | { kind: 'skill_home'; skill: string };

/** More than this between two roles is worth asking about. */
export const GAP_MONTHS = 3;
/** A long skills list would crowd out everything else, so it gets a few of the questions. */
export const MAX_SKILL_GAPS = 3;

const key = (text: string) => text.trim().toLowerCase();

/** Spans between roles, in order. Year-only dates are too rough to call a gap. */
function dateGaps(roles: readonly GapRole[]): Gap[] {
  const dated = roles
    .filter((r) => r.start && (r.end || r.current))
    .sort((a, b) => monthIndex(a.start!) - monthIndex(b.start!));
  const gaps: Gap[] = [];
  let latest: GapRole | undefined;
  for (const role of dated) {
    if (latest?.current) break;
    const end = latest?.end;
    const start = role.start!;
    if (end?.month && start.month && monthIndex(start) - monthIndex(end) > GAP_MONTHS) {
      gaps.push({ kind: 'date_gap', from: end, to: start });
    }
    if (!latest || role.current || monthIndex(role.end!) > monthIndex(latest.end!)) latest = role;
  }
  return gaps;
}

/** Most useful first: what a resume can't state without it, then what makes it stronger. */
export function detectGaps(input: GapInput): Gap[] {
  const { roles, skills, education } = input;
  const tagged = new Set(roles.flatMap((r) => r.skills.map(key)));
  return [
    ...roles.filter((r) => !r.end && !r.current).map((r): Gap => ({ kind: 'role_end', roleId: r.id })),
    ...roles.filter((r) => r.skills.length === 0).map((r): Gap => ({ kind: 'role_skills', roleId: r.id })),
    ...education.filter((e) => !e.end && !e.current).map((e): Gap => ({ kind: 'education_year', educationId: e.id })),
    ...dateGaps(roles),
    ...skills
      .filter((skill) => !tagged.has(key(skill)))
      .slice(0, MAX_SKILL_GAPS)
      .map((skill): Gap => ({ kind: 'skill_home', skill })),
  ];
}
