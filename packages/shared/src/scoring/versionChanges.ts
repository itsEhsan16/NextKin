import type { ResumeVersion, VersionChange } from '../models/resume';
import type { ResumeContent } from '../models/resumeContent';

/**
 * What a version changed against the one before it, and why (toreview §146.5). The diff reads the
 * two documents, so nothing here says a change happened that they don't show. The reason comes from
 * who made the version, or from the check that took a line out. Shared by the mock and the server.
 */

type Kind = VersionChange['kind'];
export type VersionActor = NonNullable<ResumeVersion['actor']>;

const WHY: Record<VersionActor, Record<Kind, string>> = {
  user: { added: 'You added this.', removed: 'You removed this.', reworded: 'You changed this.' },
  generation: {
    added: 'Added for this job, from your own facts.',
    removed: 'Left out of this version. The resume it was made from still has it.',
    reworded: 'Reworded for this job, from your own line.',
  },
  restore: {
    added: 'You restored an earlier version.',
    removed: 'You restored an earlier version.',
    reworded: 'You restored an earlier version.',
  },
  zero_review: {
    added: 'You confirmed this in your review.',
    removed: 'You took this out in your review.',
    reworded: 'You corrected this in your review.',
  },
  upload: { added: 'Read from your file.', removed: 'Not in your file.', reworded: 'Read from your file.' },
};

/** Why the claim check took a line out of the AI's draft, by `IssueCode`. */
const DROPPED_WHY: Readonly<Record<string, string>> = {
  untraceable: 'Nothing on your profile backs this.',
  moved_between_roles: 'This came from a different role.',
  entity_mismatch: 'This names an employer or school you never listed.',
  date_mismatch: 'These dates don’t match your roles.',
  number_not_in_facts: 'This states a number you never gave.',
  years_overstated: 'This claims more years than your roles show.',
  technology_not_backed: 'This names a technology your profile doesn’t back.',
  anachronism: 'This technology didn’t exist when the role ended.',
  skill_not_in_profile: 'This skill isn’t on your profile.',
  left_out_by_user: 'You chose to leave this out.',
};

const DRAFT = 'The AI’s draft';

/** A line the validator took out of a draft: what it said, and the issue that stopped it. */
export type DroppedLine = { text: string; reason: string };

/** One list of lines: what stayed is silent, a cited or same-place line is a rewording. */
function lineChanges(
  where: string,
  before: readonly string[],
  after: readonly string[],
  why: Record<Kind, string>,
  rewordedFrom: ReadonlyMap<string, string>,
): VersionChange[] {
  const gone = before.filter((line) => !after.includes(line));
  const fresh = after.filter((line) => !before.includes(line));
  const samePlace = before.length === after.length;
  const out: VersionChange[] = [];

  for (const line of fresh) {
    const cited = rewordedFrom.get(line);
    const was =
      cited !== undefined && gone.includes(cited)
        ? cited
        : samePlace && gone.includes(before[after.indexOf(line)] ?? '')
          ? before[after.indexOf(line)]
          : undefined;
    if (was === undefined) {
      out.push({ kind: 'added', where, text: line, why: why.added });
      continue;
    }
    gone.splice(gone.indexOf(was), 1);
    out.push({ kind: 'reworded', where, text: line, before: was, why: why.reworded });
  }
  return [...out, ...gone.map((text) => ({ kind: 'removed' as const, where, text, why: why.removed }))];
}

const roleName = (role: { title: string; company: string }) => `${role.title} at ${role.company}`;

export function versionChanges(args: {
  /** The version this one was made from. A first version has none, so nothing to compare. */
  before: ResumeContent | undefined;
  after: ResumeContent;
  actor: VersionActor;
  /** The line each rewritten line came from, when the version's citations say. */
  rewordedFrom?: ReadonlyMap<string, string>;
  dropped?: readonly DroppedLine[];
}): VersionChange[] {
  const { before, after, actor, rewordedFrom = new Map<string, string>(), dropped = [] } = args;
  const why = WHY[actor];
  const lines = (where: string, was: readonly string[], now: readonly string[], reason = why) =>
    lineChanges(where, was, now, reason, rewordedFrom);
  const present = (text: string) => (text ? [text] : []);

  const left = dropped.map(({ text, reason }): VersionChange => ({
    kind: 'removed',
    where: DRAFT,
    text,
    why: DROPPED_WHY[reason] ?? 'Our check took this out.',
  }));
  if (!before) return left;

  const roles = [...after.experience, ...before.experience.filter((r) => !after.experience.some((n) => n.id === r.id))];
  const projects = [...after.projects, ...before.projects.filter((p) => !after.projects.some((n) => n.id === p.id))];

  return [
    ...lines('Summary', present(before.summary), present(after.summary)),
    ...lines('Skills', before.skills, after.skills, actor === 'generation' ? { ...why, added: 'You said you have this.' } : why),
    ...roles.flatMap((role) =>
      lines(
        roleName(role),
        before.experience.find((r) => r.id === role.id)?.bullets ?? [],
        after.experience.find((r) => r.id === role.id)?.bullets ?? [],
      ),
    ),
    ...projects.flatMap((project) =>
      lines(
        project.name,
        before.projects.find((p) => p.id === project.id)?.bullets ?? [],
        after.projects.find((p) => p.id === project.id)?.bullets ?? [],
      ),
    ),
    ...lines('Education', before.education.map((e) => e.degree), after.education.map((e) => e.degree)),
    ...lines('Certifications', before.certifications, after.certifications),
    ...left,
  ];
}
