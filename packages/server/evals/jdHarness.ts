import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import type { JdStructured } from '@nextkin/shared/models/jdStructured';

import type { AiGateway } from '../src/ai/gateway';
import { createMemoryKv } from '../src/cache/kv';
import { extractJd, type VerifiedJd } from '../src/pipeline/stages/extractJd';
import { PROMPTS } from '../src/seed/prompts';
import type { PromptVersion } from '../src/services/prompts';
import { JD_GOLDEN, JD_GOLDEN_VERSION, type JdCase } from './jdGolden';

/**
 * Scores the structured reading against the hand-labelled set (toreview §153). Each label is one
 * check; a check fails when the reading misses a stated fact or states one the posting doesn't.
 * The bar: at least 85% of checks pass, and no case invents pay, years or a work mode it was
 * labelled as not stating.
 */

export type JdCheck = { caseId: string; check: string; pass: boolean; detail?: string };
export type JdReport = { golden: string; cases: number; checks: JdCheck[]; passRate: number; invented: JdCheck[]; keywordRecall: number | null };

const id = (name: string) => resolveSkill(TAXONOMY, name).id;
const has = (names: readonly string[], want: string) => names.some((n) => id(n) === id(want));

export function checkCase(c: JdCase, jd: VerifiedJd): JdCheck[] {
  const s = jd.structured as JdStructured | undefined;
  const w = c.want;
  const out: JdCheck[] = [];
  const add = (check: string, pass: boolean, detail?: string) => out.push({ caseId: c.id, check, pass, ...(detail ? { detail } : {}) });
  if (!s) {
    add('structured', false, 'no structured reading');
    return out;
  }
  for (const k of w.required ?? []) add(`required:${k}`, has(jd.requiredSkills, k), jd.requiredSkills.join(', '));
  for (const k of w.preferred ?? []) add(`preferred:${k}`, has(jd.preferredSkills, k), jd.preferredSkills.join(', '));
  for (const k of w.notRequired ?? []) add(`notRequired:${k}`, !has(jd.requiredSkills, k), jd.requiredSkills.join(', '));
  const range = s.compensation.range;
  if (w.pay) {
    const v = range?.value;
    add('pay', v?.min === w.pay.min && v?.max === w.pay.max && v?.currency === w.pay.currency && v?.period === w.pay.period, JSON.stringify(v ?? null));
  }
  if (w.noPay) add('noPay', !range && s.compensation.statements.length === 0, JSON.stringify(range?.value ?? null));
  if (w.payUnclear) add('payUnclear', range?.status === 'unclear', range?.status);
  if (w.minYears !== undefined) add('minYears', s.experience.minYears?.value === w.minYears, String(s.experience.minYears?.value));
  if (w.maxYears !== undefined) add('maxYears', s.experience.maxYears?.value === w.maxYears, String(s.experience.maxYears?.value));
  if (w.freshersOk) add('freshersOk', s.experience.freshersOk?.value === true);
  if (w.noYears) add('noYears', s.experience.minYears === undefined, String(s.experience.minYears?.value));
  if (w.workMode) add('workMode', s.workMode?.value === w.workMode, s.workMode?.value);
  if (w.noWorkMode) add('noWorkMode', s.workMode === undefined, s.workMode?.value);
  if (w.daysPerWeek !== undefined) add('daysPerWeek', s.schedule.some((x) => x.daysPerWeek === w.daysPerWeek), JSON.stringify(s.schedule.map((x) => x.value)));
  if (w.employmentType) add('employmentType', s.identity.employmentType?.value === w.employmentType, s.identity.employmentType?.value);
  for (const field of w.issues ?? []) add(`issue:${field}`, s.issues.some((i) => i.field === field), s.issues.map((i) => i.field).join(', '));
  if (w.noIssues) add('noIssues', s.issues.length === 0, s.issues.map((i) => i.note).join(' | '));
  const benefits = s.benefits.map((b) => b.value.toLowerCase()).join(' | ');
  for (const b of w.benefit ?? []) add(`benefit:${b}`, benefits.includes(b.toLowerCase()), benefits);
  for (const b of w.notBenefit ?? []) add(`notBenefit:${b}`, !benefits.includes(b.toLowerCase()), benefits);
  if (w.sensitive) add('sensitive', s.eligibility.some((e) => e.sensitive), JSON.stringify(s.eligibility.map((e) => e.value)));
  if (w.minResponsibilities) add('responsibilities', s.responsibilities.length >= w.minResponsibilities, String(s.responsibilities.length));
  if (w.minLocations) add('locations', s.locations.length >= w.minLocations, String(s.locations.length));
  if (w.language) add('language', jd.language === w.language, jd.language);
  if (w.title) add('title', jd.title === w.title, jd.title ?? 'none');
  if (w.company) add('company', jd.company === w.company, jd.company ?? 'none');
  const named = [...jd.requiredSkills, ...jd.preferredSkills, ...(jd.softSkills ?? [])];
  for (const k of w.notSkill ?? []) add(`notSkill:${k}`, !named.some((n) => n.toLowerCase() === k.toLowerCase()), named.join(', '));
  const schooling = s.education.map((e) => e.value).join(' | ');
  for (const e of w.education ?? []) add(`education:${e}`, schooling.toLowerCase().includes(e.toLowerCase()), schooling);
  if (w.page) add('page', jd.page?.kind === w.page, jd.page?.kind ?? 'none');
  if (w.noPage) add('noPage', jd.page === undefined, jd.page?.kind);
  if (w.chromeAbsent) {
    const kept = JSON.stringify({ ...s, issues: [], stats: null }).toLowerCase();
    for (const chrome of w.chromeAbsent) {
      // The quotes point into the text, so chrome would show up as a value; check values only.
      const values = [...s.responsibilities, ...s.extras, ...s.benefits, ...s.application, ...s.company.about].map((f) => f.value.toLowerCase()).join(' | ');
      add(`chrome:${chrome}`, !values.includes(chrome.toLowerCase()), kept.length > 0 ? values.slice(0, 200) : undefined);
    }
  }
  return out;
}

/** Checks a case labelled "states none" failing: the reading invented something. */
const INVENTION = new Set(['noPay', 'noYears', 'noWorkMode', 'notRequired', 'noPage', 'notSkill']);

export function seedPrompt(): PromptVersion {
  const p = PROMPTS.find((x) => x.name === 'jd.extract')!;
  return { id: `seed:jd.extract:v${p.version ?? 1}`, templateId: 'seed:jd.extract', version: p.version ?? 1, body: p.body } as PromptVersion;
}

export async function runJdGolden(gateway: AiGateway, cases: readonly JdCase[] = JD_GOLDEN): Promise<JdReport> {
  const prompt = seedPrompt();
  const checks: JdCheck[] = [];
  for (const c of cases) {
    try {
      const { jd } = await extractJd({ gateway, cache: createMemoryKv(), prompt, text: c.text, context: { tag: 'eval' } });
      checks.push(...checkCase(c, jd));
    } catch (error) {
      checks.push({ caseId: c.id, check: 'read', pass: false, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  const passed = checks.filter((c) => c.pass).length;
  return {
    golden: JD_GOLDEN_VERSION,
    cases: cases.length,
    checks,
    passRate: checks.length ? passed / checks.length : 0,
    invented: checks.filter((c) => !c.pass && INVENTION.has(c.check.split(':')[0]!)),
    keywordRecall: recallOf(checks),
  };
}

/** Of the skills the labels say a posting names, the share the reading found (toreview §206.2). */
function recallOf(checks: readonly JdCheck[]): number | null {
  const named = checks.filter((c) => c.check.startsWith('required:') || c.check.startsWith('preferred:'));
  return named.length ? named.filter((c) => c.pass).length / named.length : null;
}

export function jdGate(report: JdReport): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (report.passRate < 0.85) failures.push(`checks passed ${(report.passRate * 100).toFixed(0)}% (bar 85%)`);
  for (const i of report.invented) failures.push(`invented in ${i.caseId}: ${i.check} (${i.detail ?? ''})`);
  return { pass: failures.length === 0, failures };
}
