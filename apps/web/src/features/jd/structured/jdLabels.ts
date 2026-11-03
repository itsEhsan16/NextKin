import { payText } from '@nextkin/shared/jobs/jdChecks';
import type {
  ApplicationKind,
  EligibilityKind,
  JdStructured,
  LanguageLevel,
  SkillCategory,
  WorkMode,
} from '@nextkin/shared/models';

/** How the structured job page (toreview §153) says each value: plain words, never a code. */

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  onsite: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
  field: 'Field-based',
  flexible: 'Flexible',
};

/** Skill groups in the order a reader scans them; soft skills are shown on their own. */
export const SKILL_GROUPS: readonly { category: SkillCategory; label: string }[] = [
  { category: 'language', label: 'Programming languages' },
  { category: 'framework', label: 'Frameworks' },
  { category: 'database', label: 'Databases' },
  { category: 'cloud', label: 'Cloud' },
  { category: 'api', label: 'APIs and integrations' },
  { category: 'tool', label: 'Tools' },
  { category: 'domain', label: 'Domain knowledge' },
  { category: 'other', label: 'Other skills' },
];

export const LEVEL_LABEL: Record<LanguageLevel, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

export const ELIGIBILITY_LABEL: Record<EligibilityKind, string> = {
  age: 'Age',
  work_authorization: 'Work authorisation',
  location: 'Location',
  gender: 'Gender',
  background_check: 'Background check',
  other: 'Condition',
};

export const APPLICATION_LABEL: Record<ApplicationKind, string> = {
  method: 'How to apply',
  url: 'Apply at',
  email: 'Email',
  deadline: 'Closing date',
  documents: 'Documents',
  process: 'Hiring process',
};

const years = (n: number) => `${n} year${n === 1 ? '' : 's'}`;

/** "1–3 years", "1+ years", "Freshers welcome", or both when the posting says both. */
export function experienceText(e: JdStructured['experience']): string | undefined {
  const min = e.minYears?.value;
  const max = e.maxYears?.value;
  const ask =
    min === undefined
      ? undefined
      : max !== undefined && max !== min
        ? `${min}–${years(max)}`
        : `${years(min)}${min > 0 ? '+' : ''}`;
  const freshers = e.freshersOk?.value ? 'Freshers welcome' : undefined;
  return [ask, freshers].filter(Boolean).join(' · ') || undefined;
}

/** "₹45,000–₹80,000 a month": the range the posting states. */
export function payLabel(s: JdStructured): string | undefined {
  const range = s.compensation.range?.value;
  return range ? payText(range) : undefined;
}

/** "5 days a week", else the schedule's first line as written. */
export function scheduleText(s: JdStructured): string | undefined {
  const days = s.schedule.find((x) => x.daysPerWeek !== undefined)?.daysPerWeek;
  if (days !== undefined) return `${days} days a week`;
  return s.schedule[0]?.value;
}

export function locationText(s: JdStructured): string | undefined {
  const labels = s.locations.map((l) => l.value.label);
  if (labels.length === 0) return undefined;
  return labels.length > 2 ? `${labels[0]} and ${labels.length - 1} more` : labels.join(' · ');
}
