import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { mentionsIn } from '@nextkin/engines/normalizer';
import { sentences } from '@nextkin/engines/text';

import type { FakeScript } from '../src/ai/providers/fake';
import type { LlmRequest } from '../src/ai/types';

/**
 * Scripted models for the pipeline suites and the eval harness, until live recordings exist
 * (toreview §105.16). They read the stage input exactly as a model would and answer in the stage's
 * schema:
 * - `groundedModel` writes only what the input's facts say, citing their ids: a perfect generator,
 *   so the pipeline's guarantees are tested in isolation from model quality.
 * - `fabricatingModel` invents an employer-free but false claim in every bullet (a number and a
 *   technology the role does not have), the way a careless model would. Its revisions are grounded
 *   (`stubbornModel` keeps fabricating in its revisions), so the repair path and the strip path are
 *   both exercised.
 *
 * Neither is a stand-in for a real model's quality; the golden set's live run measures that.
 */

type Json = Record<string, unknown>;

function parts(request: LlmRequest): { input: Json; document: string } {
  const content = request.messages[0]?.content ?? '';
  const input = /<input>\n([\s\S]*?)\n<\/input>/.exec(content)?.[1] ?? '{}';
  const document = /<document>\n([\s\S]*?)\n<\/document>/.exec(content)?.[1] ?? '';
  return { input: JSON.parse(input) as Json, document };
}

type Role = { roleId: string; title: string; company: string; facts: { id: string; text: string }[]; allowedSkills: string[] };
type Project = { projectId: string; maxBullets: number; facts: { id: string; text: string }[] };
type Profile = { headline: string | null; summary: string | null; summaryFactId: string | null; listedSkills: string[]; roles: Role[]; projects?: Project[] };

function readJd(document: string) {
  const lines = document.split('\n').map((l) => l.trim()).filter(Boolean);
  const required: { text: string; quote: string }[] = [];
  const preferred: { text: string; quote: string }[] = [];
  for (const range of sentences(document)) {
    const sentence = document.slice(range.start, range.end).trim();
    const nice = /nice to have|preferred|bonus|plus/i.test(sentence);
    for (const m of mentionsIn(TAXONOMY, sentence)) (nice ? preferred : required).push({ text: m.surface, quote: sentence });
  }
  const company = /\bat ([A-Z][\w&.]+(?: [A-Z][\w&.]+)*)/.exec(document)?.[1] ?? null;
  return {
    title: lines[0]?.replace(/ at .*$/, '').replace(/[.,].*$/, '') ?? null,
    company,
    location: null,
    experienceLevel: null,
    employmentType: null,
    domain: null,
    language: /\b(und|wir|mit|für|Erfahrung)\b/.test(document) ? 'de' : 'en',
    requiredSkills: required,
    preferredSkills: preferred.filter((p) => !required.some((r) => r.text === p.text)),
    tools: [],
    responsibilities: [],
    softSkills: [],
  };
}

function groundedResume(input: Json) {
  const profile = input.profile as Profile;
  const firstFacts = profile.roles.flatMap((r) => r.facts.slice(0, 1).map((f) => f.id));
  return {
    headline: profile.headline ?? profile.roles[0]?.title ?? null,
    summary: profile.summary && profile.summaryFactId ? { text: profile.summary, evidence: [profile.summaryFactId] } : firstFacts.length ? { text: `${profile.roles[0]!.title} with experience at ${profile.roles.map((r) => r.company).join(' and ')}.`, evidence: [profile.roles[0]!.roleId] } : null,
    skills: profile.listedSkills.slice(0, 12).map((name) => ({ name, evidence: [profile.roles.find((r) => r.allowedSkills.includes(name))?.roleId ?? profile.roles[0]!.roleId] })),
    roles: profile.roles.map((r) => ({ roleId: r.roleId, bullets: r.facts.slice(0, 4).map((f) => ({ text: f.text, evidence: [f.id] })) })),
    projects: (profile.projects ?? []).map((p) => ({ projectId: p.projectId, bullets: p.facts.slice(0, p.maxBullets).map((f) => ({ text: f.text, evidence: [f.id] })) })),
  };
}

function groundedLetter(input: Json) {
  const roles = input.roles as Role[];
  const target = input.target as { title?: string; company?: string | null } | null;
  return {
    greeting: target?.company ? `Dear ${target.company} team,` : 'Dear hiring team,',
    paragraphs: roles.slice(0, 2).filter((r) => r.facts.length).map((r) => ({ text: `At ${r.company} I worked as ${r.title}. ${r.facts[0]!.text}.`, evidence: [r.roleId, r.facts[0]!.id] })),
  };
}

const ZERO = {
  headline: 'Product designer',
  summary: 'Designer with around 5 years of experience shipping consumer products.',
  skills: ['Figma', 'User research', 'Prototyping'],
  roles: [
    { title: 'Product Designer', startYearsAgo: 3, endYearsAgo: null, bullets: ['Designed onboarding flows that lifted activation 20%', 'Ran usability tests with users'] },
    { title: 'UI Designer', startYearsAgo: 5, endYearsAgo: 3, bullets: ['Built a component library used by 4 squads'] },
  ],
  education: [{ degree: 'Bachelor of Design' }],
};

/** One technical question per eligible skill, behavioural ones from the job; a fabricating model strays onto the excluded skills. */
function interviewSet(input: Json, fabricate: boolean) {
  const eligible = (input.eligibleSkills as string[]) ?? [];
  const excluded = (input.excludedSkills as string[]) ?? [];
  const lines = ((input.responsibilities as string[]) ?? []).slice(0, 3);
  const tech = (skill: string) => ({ kind: 'technical', skill, prompt: `How have you used ${skill} on a real project?`, answer: `Pick one project where ${skill} mattered and walk through it.`, talkingPoints: ['Problem, action, result.'] });
  const questions = [
    ...eligible.map(tech),
    ...lines.map((line) => ({ kind: 'behavioural', skill: null, prompt: `Tell me about a time you handled: ${line}`, answer: 'Situation, task, action, result.', talkingPoints: ['Most of the time on the action.'] })),
    { kind: 'behavioural', skill: null, prompt: `Why do you want to work as a ${String(input.roleTitle)}?`, answer: 'Say what draws you to the work.', talkingPoints: ['Forward, not backward.'] },
  ];
  if (!fabricate) return { questions };
  return {
    questions: [
      ...questions,
      ...excluded.map(tech),
      ...excluded.map((skill) => ({ kind: 'behavioural', skill: null, prompt: `Describe a launch you led.`, answer: `Mention how ${skill} helped you ship it.`, talkingPoints: [] })),
      { kind: 'technical', skill: 'Cobol', prompt: 'Explain how you would migrate a Cobol batch job.', answer: 'Start with the data.', talkingPoints: [] },
    ],
  };
}

type Mode = 'grounded' | 'fabricating' | 'stubborn';

function answer(request: LlmRequest, mode: Mode): Json | undefined {
  const fabricate = mode !== 'grounded';
  const name = request.output?.name;
  const { input, document } = parts(request);
  switch (name) {
    case 'job_description': {
      const jd = readJd(document);
      // One item the text does not say, to prove the verifier drops and counts it.
      return { ...jd, preferredSkills: [...jd.preferredSkills, { text: 'Blockchain', quote: 'Experience with blockchain is a plus' }] };
    }
    case 'resume': {
      const draft = groundedResume(input);
      if (!fabricate) return draft;
      return { ...draft, roles: draft.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, text: `${b.text}, saving 37 hours a week using Kafka` })) })) };
    }
    case 'revision': {
      const wanted = input.rewrite as { summary: boolean; skills: boolean; roleIds: string[] };
      const draft = groundedResume(input);
      const keepFabricating = mode === 'stubborn';
      return {
        summary: wanted.summary ? draft.summary : null,
        skills: wanted.skills ? draft.skills : null,
        roles: draft.roles.filter((r) => wanted.roleIds.includes(r.roleId)).map((r) => (keepFabricating ? { ...r, bullets: r.bullets.map((b) => ({ ...b, text: `${b.text} for 900 clients` })) } : r)),
      };
    }
    case 'cover_letter':
      return groundedLetter(input);
    case 'zero_resume':
      return ZERO;
    case 'interview_set':
      return interviewSet(input, fabricate);
    case 'technology': {
      const techName = String(input.name ?? 'Unknown');
      return { isTechnology: true, canonicalName: techName, category: 'tool', aliases: [], releaseYear: 2015, safeUsageYear: 2016, enterpriseAdoptionYear: 2018, sourceUrl: 'https://www.wikidata.org/wiki/Q42' };
    }
    default:
      return undefined;
  }
}

export const groundedModel: FakeScript = (request) => {
  const data = answer(request, 'grounded');
  return data ? { data, text: '', stopReason: 'tool_use' } : undefined;
};

export const fabricatingModel: FakeScript = (request) => {
  const data = answer(request, 'fabricating');
  return data ? { data, text: '', stopReason: 'tool_use' } : undefined;
};

/** Fabricates in its revisions too: what is left must be stripped. */
export const stubbornModel: FakeScript = (request) => {
  const data = answer(request, 'stubborn');
  return data ? { data, text: '', stopReason: 'tool_use' } : undefined;
};
