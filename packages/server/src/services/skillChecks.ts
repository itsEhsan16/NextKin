import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { parsePartialDate } from '@nextkin/engines/dates';
import { validateTimeline } from '@nextkin/engines/timeline';
import type { Experience, SkillWarning } from '@nextkin/shared/models/profile';

/**
 * Inline skill validation (ImBackendImplementationPlan P9-05, old M1-08; V2 §7.3, §7.7). Every
 * profile read checks each role's skill tags against the role's dates with the timeline engine. A
 * skill that does not fit is a warning on the profile, never a block: the user may know better, and
 * a machine-generated KB entry can only flag (§7.7). A technology the KB does not know is marked
 * unverified.
 */

const MESSAGE: Record<SkillWarning['verdict'], (skill: string) => string> = {
  invalid: (skill) => `${skill} did not exist yet when this role ended.`,
  suspect: (skill) => `${skill} was very new when this role ended. Keep it only if you really used it then.`,
  unverified: (skill) => `We can’t check ${skill} against this role’s dates yet.`,
};

export function skillWarnings(experiences: readonly Experience[], now: Date = new Date()): SkillWarning[] {
  const asOf = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const report = validateTimeline({
    roles: experiences.map((e) => ({
      id: e.id,
      start: parsePartialDate(e.startDate),
      end: e.current ? null : (parsePartialDate(e.endDate) ?? undefined),
      skills: e.skills,
    })),
    kb: KB,
    taxonomy: TAXONOMY,
    asOf,
  });
  return report.pairs
    .filter((p) => p.verdict === 'invalid' || p.verdict === 'suspect' || p.rule === 'not_in_kb')
    .map((p) => {
      const verdict = p.verdict === 'valid' ? 'unverified' : (p.verdict as SkillWarning['verdict']);
      return { experienceId: p.roleId, skill: p.surface, verdict, message: MESSAGE[verdict](p.surface) };
    });
}
