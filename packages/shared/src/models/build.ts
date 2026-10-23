import { parsePartialDate } from '@nextkin/engines/dates';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { rubricById } from '@nextkin/engines/provenance';
import { buildLedger, type Evidence } from '@nextkin/engines/requirements';
import { phraseKey } from '@nextkin/engines/text';

import { asOfDate, jdLists, requirementsOf } from '../scoring/adapters';
import type { JdDraft } from './jd';
import type { Experience } from './profile';
import { atsBandFor } from './resume';
import type { TailorChange, TailorChoices, TailorImprovement, TailorKeyword } from './tailor';

/**
 * Home's Build Resume flow (BUILD 01–06, toreview §67): a resume built from the profile for one
 * job. These are the pure readings its screens share — what the job asks for against what the
 * profile backs, and what the build changed — so the review card and the ready screen agree.
 */

export type ProfileKeyword = { label: string; onProfile: boolean };

/** What the build reads off the profile: its skills, and its dated roles when it has them. */
type ProfileLike = { headline?: string; skills: readonly string[]; experiences?: readonly Experience[] };

const asOfNow = () => asOfDate(new Date());

/** The profile as engine evidence: each dated role's tags, and the skills it lists (D-14). */
function profileEvidence(profile: ProfileLike): Evidence {
  return {
    roles: (profile.experiences ?? []).map((exp) => {
      const start = parsePartialDate(exp.startDate) ?? undefined;
      const end = exp.current ? null : (parsePartialDate(exp.endDate) ?? undefined);
      return { id: exp.id, ...(start ? { start } : {}), ...(end !== undefined ? { end } : {}), skills: exp.skills.map((skill) => resolveSkill(TAXONOMY, skill).id) };
    }),
    listed: profile.skills.map((skill) => resolveSkill(TAXONOMY, skill).id),
  };
}

/** BUILD 04 draws what the job asks for as its required and preferred skills; its tools list is not part of it. */
function ledgerFor(draft: JdDraft, profile: ProfileLike) {
  const lists = { ...jdLists(draft), tools: [] };
  return buildLedger({ requirements: requirementsOf(lists), evidence: profileEvidence(profile), rubric: rubricById(), asOf: asOfNow() });
}

/**
 * "What the job asks for" (BUILD 04): every required and preferred skill once, the ones the
 * profile backs first, matched by canonical skill (C-10) — "Postgres" backs "PostgreSQL", and
 * "Java" never backs "JavaScript". A keyword the profile does not back is shown, never written in.
 */
export function profileKeywordFit(draft: JdDraft, profileSkills: readonly string[]): ProfileKeyword[] {
  const out = ledgerFor(draft, { skills: profileSkills })
    .entries.filter((e) => e.kind === 'skill')
    .map((e) => ({ label: e.text, onProfile: e.status !== 'gap' }));
  return [...out.filter((k) => k.onProfile), ...out.filter((k) => !k.onProfile)];
}

/**
 * BUILD 04b (663:2) — the profile against the job, before anything is built: requirement coverage
 * as the JOB MATCH ring (not an ATS score: there is no resume yet to score, D-15), the job's
 * keywords on and off the profile, and what the build will improve.
 */
export type BuildComparison = {
  /** 0–100: the requirement ledger's match, D-14's evidence tiers included. */
  score: number;
  keywords: TailorKeyword[];
  improvements: TailorImprovement[];
};

export function compareProfileToJob(draft: JdDraft, profile: ProfileLike): BuildComparison {
  const ledger = ledgerFor(draft, profile);
  const fit = ledger.entries
    .filter((e) => e.kind === 'skill')
    .map((e): TailorKeyword => ({ label: e.text, onResume: e.status !== 'gap', source: e.importance === 'required' ? 'required' : 'description' }));
  const keywords = [...fit.filter((k) => k.onResume), ...fit.filter((k) => !k.onResume)];
  // A job that names no skill the engines can read asks for nothing the profile lacks.
  const score = ledger.matchBps === null ? 100 : Math.round(ledger.matchBps / 100);

  const title = draft.title?.trim();
  const headline = profile.headline?.trim();
  const headlineOk = !title || (headline != null && ` ${phraseKey(headline)} `.includes(` ${phraseKey(title)} `));
  const company = draft.company?.trim();

  return {
    score,
    keywords,
    improvements: [
      {
        key: 'headline',
        label: 'Headline',
        detail: headlineOk ? 'Already says what this job is.' : `Says ${headline ?? 'nothing yet'}. This job is ${title}.`,
        ok: headlineOk,
      },
      { key: 'summary', label: 'Summary', detail: 'We’ll write one aimed at this job.', ok: false },
      {
        key: 'skills',
        label: 'Skill order',
        detail: `We’ll lead with what ${company ?? 'the job'} asks for.`,
        ok: false,
      },
      { key: 'layout', label: 'Layout', detail: 'Easy for an ATS to read.', ok: true },
    ],
  };
}

/** "A good start. Let's make it stronger", said of the profile (BUILD 04b 663:27 / 663:28). */
export function buildHeadline(score: number): { title: string; lede: (company: string) => string } {
  const band = atsBandFor(score);
  if (band === 'strong') {
    return {
      title: 'A strong match.\nA few touches left',
      lede: (company) =>
        `Your profile already covers what ${company} asks for. A couple of fixes will polish the resume.`,
    };
  }
  if (band === 'good') {
    return {
      title: 'A good start.\nLet’s make it stronger',
      lede: (company) =>
        `Your profile covers most of what ${company} asks for. A few fixes will make the resume stronger.`,
    };
  }
  return {
    title: 'Some work to do.\nLet’s close the gaps',
    lede: (company) =>
      `Your profile misses several things ${company} asks for. The fixes below will make the resume stronger.`,
  };
}

const joinList = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * "What changed for this job" on a built resume (BUILD 06). Only what a build from the profile
 * does — the summary aimed at the role and the skills put in the job's order — then what the user
 * answered on 04c: what they added, and what they left out. A build from before 04c (no answers)
 * says which keywords it left out because the profile did not back them. Never a change it did
 * not make.
 */
export function buildChanges(
  company: string | undefined,
  fit: readonly ProfileKeyword[],
  choices?: TailorChoices,
): TailorChange[] {
  const changes: TailorChange[] = [
    {
      label: company ? `Summary aimed at the ${company} role` : 'Summary aimed at this role',
      left: false,
    },
  ];
  if (fit.some((k) => k.onProfile)) {
    changes.push({ label: 'Skills ordered to match the job', left: false });
  }
  if (choices) {
    if (choices.added.length > 0) {
      changes.push({
        label: `Added ${joinList(choices.added.map((k) => k.toLowerCase()))}`,
        left: false,
      });
    }
    for (const skipped of choices.skipped) {
      changes.push({ label: `${skipped.split(/[ /]/)[0]} left out, as you chose`, left: true });
    }
    return changes;
  }
  for (const keyword of fit.filter((k) => !k.onProfile)) {
    changes.push({ label: `${keyword.label} left out — it is not on your profile`, left: true });
  }
  return changes;
}
