import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import type { PartialDate } from '@nextkin/engines/dates';
import type { ScoringDocument } from '@nextkin/engines/document';
import { checkJd, checkResume, type PlausibilityFinding, type PlausibilityReport } from '@nextkin/engines/plausibility';
import type { JdLists } from '@nextkin/engines/requirements';

import { requirementsOf } from './adapters';

/**
 * The plausibility engine's findings in words (toreview §129). The engine decides what cannot be
 * true; this file only says it, with the numbers it rests on (G17). Phone-safe, so the mock and the
 * server word a finding the same way.
 */

export type PlausibilityNote = {
  code: PlausibilityFinding['code'];
  /** `impossible` rests on reviewed dates; `suspect` on dates not yet reviewed, or on a judgement. */
  severity: PlausibilityFinding['severity'];
  /** One line: what was claimed. */
  title: string;
  /** Why it cannot be true, and what we do about it. */
  detail: string;
  skill?: string;
  roleId?: string;
};

const yearsWord = (n: number) => `${n} year${n === 1 ? '' : 's'}`;

function noteOf(f: PlausibilityFinding, roleName: (id: string) => string): PlausibilityNote {
  const b = f.basis;
  const base = { code: f.code, severity: f.severity, ...(f.skillId ? { skill: f.subject } : {}), ...(f.roleId ? { roleId: f.roleId } : {}) };
  switch (f.code) {
    case 'jd_years_exceed_tech_age':
      return {
        ...base,
        title: `Asks for ${yearsWord(b.yearsAsked!)} of ${f.subject}`,
        detail: `${f.subject} was released in ${b.releaseYear}, so nobody can have more than about ${yearsWord(b.maxYears!)}. We measure your ${f.subject} against ${yearsWord(b.maxYears!)} instead.`,
      };
    case 'jd_years_implausible':
      return {
        ...base,
        title: `Asks for ${yearsWord(b.yearsAsked!)} of ${f.subject}`,
        detail: `That is longer than a working life. We measure your ${f.subject} against ${yearsWord(b.maxYears!)} instead.`,
      };
    case 'claim_years_exceed_tech_age':
      return {
        ...base,
        title: `Says ${yearsWord(b.yearsAsked!)} of ${f.subject}`,
        detail: `${f.subject} was released in ${b.releaseYear}, so at most about ${yearsWord(b.maxYears!)} is possible. Lower it to what your roles show.`,
      };
    case 'role_before_release':
      return {
        ...base,
        title: `${f.subject} in your ${roleName(f.roleId!)} role`,
        detail: `${f.subject} was released in ${b.releaseYear}, but this role ended in ${b.end}. Check the dates, or take ${f.subject} off this role.`,
      };
    case 'end_before_start':
      return { ...base, title: `${roleName(f.roleId!)}: the end date is before the start`, detail: `It reads ${b.start} to ${b.end}. Check the dates.` };
    case 'start_in_future':
      return { ...base, title: `${roleName(f.roleId!)} starts in the future`, detail: `It starts ${b.start}. Check the date.` };
    case 'stated_total_exceeds_roles': {
      const shown = Math.round((b.shownMonths! / 12) * 10) / 10;
      return {
        ...base,
        title: `Says ${yearsWord(b.yearsAsked!)} of experience`,
        detail: `Your dated roles add up to about ${shown} years. Add the missing roles, or lower the figure.`,
      };
    }
  }
}

const notes = (report: PlausibilityReport, roleName: (id: string) => string) => report.findings.map((f) => noteOf(f, roleName));

/** What a JD asks that nobody could have ("20 years of React"). */
export function jdPlausibility(lists: JdLists, asOf: PartialDate): PlausibilityNote[] {
  return notes(checkJd({ requirements: requirementsOf(lists), kb: KB, asOf }), (id) => id);
}

/** What a resume claims that cannot be true: years past a technology's age, dates that don't add up. */
export function resumePlausibility(doc: ScoringDocument, asOf: PartialDate, statedTotalYears?: number): PlausibilityNote[] {
  const report = checkResume({
    roles: doc.roles.map((r) => ({ id: r.id, start: r.start, end: r.end, skills: r.skills, text: [r.title, ...r.bullets].join('\n') })),
    text: doc.summary ?? '',
    ...(statedTotalYears !== undefined ? { statedTotalYears } : {}),
    kb: KB,
    taxonomy: TAXONOMY,
    asOf,
  });
  return notes(report, (id) => doc.roles.find((r) => r.id === id)?.company ?? 'this');
}
