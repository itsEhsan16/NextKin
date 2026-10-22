import type { CareerGoal, ExperienceBand } from '@nextkin/shared/models';

/** What ONB 08's summary is built from: the answers, and nothing else (816:196). */
export type StartingFacts = {
  title?: string;
  band?: ExperienceBand;
  company?: string;
  skills: readonly string[];
  goal?: CareerGoal;
  targetRole?: string;
};

const BAND_YEARS: Record<Exclude<ExperienceBand, 'new_grad'>, string> = {
  '1_2': '1–2 years',
  '3_5': '3–5 years',
  '6_10': '6–10 years',
  '10_plus': 'more than 10 years',
};

/** "a, b and c". */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What the user said they are after, as the end of a sentence. */
function aim(goal: CareerGoal | undefined, role: string | undefined): string | undefined {
  switch (goal) {
    case 'better_role':
      return role ? `is looking for a ${role} role` : 'is looking for a step up in the same field';
    case 'first_job':
      return role ? `is looking for a first role as a ${role}` : 'is looking for a first role';
    case 'new_field':
      return role ? `is looking to move into ${role}` : 'is looking to move into a new field';
    case 'exploring':
      return 'is exploring what’s next';
    default:
      return role ? `is looking for a ${role} role` : undefined;
  }
}

/**
 * ONB 08's draft summary: "Senior UX designer with 6–10 years of experience, most recently at
 * Flipkart. Works across user research, design systems and prototyping, and is looking for a lead
 * role." Every clause comes from an answer; a missing answer drops its clause rather than being
 * guessed (G13), and the card marks the whole thing a draft to check.
 */
export function startingSummary(facts: StartingFacts): string {
  const title = facts.title?.trim();
  const company = facts.company?.trim();
  const role = facts.targetRole?.trim() || undefined;

  let lead = '';
  if (facts.band === 'new_grad')
    lead = title ? `${title} at the start of their career` : 'At the start of their career';
  else if (facts.band)
    lead = title
      ? `${title} with ${BAND_YEARS[facts.band]} of experience`
      : `${capitalise(BAND_YEARS[facts.band])} of experience`;
  else if (title) lead = title;
  if (company) lead = lead ? `${lead}, most recently at ${company}` : `Most recently at ${company}`;

  const skills = facts.skills.slice(0, 3);
  const wants = aim(facts.goal, role);
  let second = '';
  if (skills.length && wants) second = `Works across ${listOf(skills)}, and ${wants}.`;
  else if (skills.length) second = `Works across ${listOf(skills)}.`;
  else if (wants) second = `${capitalise(wants.replace(/^is /, ''))}.`;

  return [lead && `${lead}.`, second].filter(Boolean).join(' ');
}

/** "GS" from "George Smith". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
