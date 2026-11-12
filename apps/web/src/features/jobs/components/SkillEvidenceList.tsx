import type { Profile } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { CheckCircle, Plus } from '@/ui/lineIcons';
import { pressable } from '@/ui/pressable';

/**
 * How well a job's skills are backed by the profile (redesign R5c, audits JD-02 and JB-22), drawn
 * one way on the job page and the JD page. They used to be three: green ticks and amber dashed
 * "+" chips on the job page, white chips with a different tick on the JD page.
 *
 * Three states, as the match engine counts them (D-14):
 * - shown: in a dated role's skills. Full credit.
 * - listed: on the profile's skill list, but no dated role shows it. Half credit.
 * - missing: not on the profile. Neutral, never an error colour; when the page can add it, it
 *   is a button.
 */
export type SkillEvidence = 'shown' | 'listed' | 'missing';

const norm = (text: string) => text.trim().toLowerCase();

export function skillEvidence(profile: Profile | undefined, skill: string): SkillEvidence {
  if (!profile) return 'missing';
  const want = norm(skill);
  if (profile.experiences.some((role) => role.skills.some((own) => norm(own) === want)))
    return 'shown';
  if (profile.skills.some((own) => norm(own) === want)) return 'listed';
  return 'missing';
}

const CHIP = 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption-m font-medium';

const STATE_TEXT: Record<SkillEvidence, string> = {
  shown: 'shown in a dated role',
  listed: 'listed on your profile, not shown in a dated role',
  missing: 'not on your profile',
};

/** The half-filled mark: some credit, not full. */
function HalfMark() {
  return (
    <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-current half-fill" />
  );
}

export function SkillEvidenceList({
  skills,
  profile,
  label,
  onAdd,
  disabled = false,
}: {
  skills: readonly string[];
  profile: Profile | undefined;
  /** The list's accessible name: "Skills this job asks for". */
  label: string;
  /** Adds a missing skill to the profile; without it, missing skills are plain chips. */
  onAdd?: (skill: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const state = skillEvidence(profile, skill);
        if (state === 'missing' && onAdd)
          return (
            <li key={skill}>
              <button
                type="button"
                onClick={() => onAdd(skill)}
                disabled={disabled}
                aria-label={`Add ${skill} to your profile`}
                className={cn(
                  pressable,
                  CHIP,
                  'border border-dashed border-border-default bg-surface-card text-text-secondary',
                  'not-disabled:hover:border-border-brand not-disabled:hover:text-text-brand disabled:opacity-60',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                )}
              >
                <Plus aria-hidden className="size-3.5" />
                {skill}
              </button>
            </li>
          );
        return (
          <li
            key={skill}
            className={cn(
              CHIP,
              state === 'shown' && 'bg-feedback-success-surface text-feedback-success-text',
              state === 'listed' && 'bg-surface-brand-tint text-text-brand',
              state === 'missing' &&
                'border border-dashed border-border-default bg-surface-card text-text-secondary',
            )}
          >
            {state === 'shown' && <CheckCircle aria-hidden className="size-3.5" />}
            {state === 'listed' && <HalfMark />}
            {skill}
            <span className="sr-only"> ({STATE_TEXT[state]})</span>
          </li>
        );
      })}
    </ul>
  );
}

/** What the three looks mean, in one line under the heading. */
export function SkillEvidenceLegend({ canAdd = false }: { canAdd?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption-m text-text-tertiary">
      <span className="flex items-center gap-1.5">
        <CheckCircle aria-hidden className="size-3.5 text-feedback-success-icon" />
        In a dated role
      </span>
      <span className="flex items-center gap-1.5 text-text-brand">
        <HalfMark />
        <span className="text-text-tertiary">Only listed (counts half until a role shows it)</span>
      </span>
      <span className="flex items-center gap-1.5">
        {canAdd ? (
          <Plus aria-hidden className="size-3.5" />
        ) : (
          <span aria-hidden className="size-3 rounded-full border border-dashed border-current" />
        )}
        {canAdd ? 'Not on your profile: add it if you have it' : 'Not on your profile'}
      </span>
    </p>
  );
}
