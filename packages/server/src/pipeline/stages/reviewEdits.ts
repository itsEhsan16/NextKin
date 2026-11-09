import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import type { ProfileFacts } from '@nextkin/engines/facts';
import { leftOutChecker } from '@nextkin/engines/leftOut';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { checkProjectBullets } from '@nextkin/engines/projectClaims';
import { phraseKey } from '@nextkin/engines/text';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { headerStatements, statementFitsJob } from '@nextkin/shared/scoring/headerChecks';
import { summarySentences } from '@nextkin/shared/scoring/lineRestore';
import { reconcileStructure } from '@nextkin/shared/scoring/structure';
import type { ReviewedOut } from '@nextkin/shared/scoring/versionChanges';
import { z } from 'zod';

import { isBoltOn, rewrittenRoles, skillKey, type TailorRunInput } from './tailorMerge';
import { ledgerOf } from './validate';

/**
 * The AI's review of a whole tailored resume (toreview §170), applied by code: the model proposes
 * typed edits, and each one is applied only when it passes its check (G14). The owner's rules:
 * - the summary and bullets go through the claim ledger like any written line, keep every number
 *   their old text stated, and are changed only in parts the user switched on;
 * - a skill never vanishes unless it is a duplicate of one kept, or a ticked job phrase that is not
 *   a skill ("Java fundamentals"); every real skill the user ticked stays listed;
 * - orders must be permutations of what is there: text is never changed by an order;
 * - a line that doesn't serve the job (relocating to a city the job never names, a summary
 *   sentence about another kind of work, an unrelated bullet) is taken out, never just flagged
 *   (owner, 2026-11-09, §202, reversing §170.1), and each one is listed in "What changed" with
 *   Restore. Contact is never sent and never removed; a line that is the only proof of a skill the
 *   user ticked or the job asks for stays; a role keeps at least one bullet.
 */

const OPS = ['summary', 'bullet', 'move_skill', 'drop_skill', 'rename_line', 'order_sections', 'order_projects', 'order_bullets', 'remove_line'] as const;
export type ReviewOp = (typeof OPS)[number];

export const reviewEditSchema = z.object({
  op: z.enum(OPS),
  /** A bullet id, a skill, a line's label, a role or project id, "header:<index>" or "summary:<index>". */
  target: z.string().trim().max(200).nullable(),
  /** The new summary or bullet; the line a skill moves to; a line's new label. */
  text: z.string().trim().max(400).nullable(),
  evidence: z.array(z.string().max(80)).max(8).nullable(),
  order: z.array(z.string().max(80)).max(16).nullable(),
  /** For a duplicate skill: the one that stays. */
  keep: z.string().trim().max(120).nullable(),
  reason: z.string().trim().min(1).max(200),
});
export const reviewSchema = z.object({
  issues: z.array(z.string().trim().min(1).max(300)).max(20),
  edits: z.array(reviewEditSchema).max(40),
});
export type ReviewEdit = z.infer<typeof reviewEditSchema>;

export interface ReviewRecord {
  applied: { op: ReviewOp; target: string | null; text?: string; reason: string }[];
  refused: { op: ReviewOp; target: string | null; why: string }[];
  issues: string[];
  /** Lines the review took out because they don't serve this job, each with its Restore. */
  removed: ReviewedOut[];
  /** Set when the review could not run; the document is then the merge's. */
  unavailable?: string;
}

export const emptyReview = (unavailable?: string): ReviewRecord => ({ applied: [], refused: [], issues: [], removed: [], ...(unavailable ? { unavailable } : {}) });

type Doc = CanonicalResumeJson;
type Groups = NonNullable<Doc['skillGroups']>;

const numbersIn = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));
const keepsNumbers = (before: string, after: string) => {
  const now = new Set(numbersIn(after));
  return numbersIn(before).every((n) => now.has(n));
};
const wordsOf = (text: string) => new Set(phraseKey(text).split(' ').filter((w) => w.length >= 2));
const within = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((w) => b.has(w));
/** "Git" beside "Git & GitHub workflows", "postgres" beside "PostgreSQL": the same skill twice. */
const duplicates = (a: string, b: string) => skillKey(a) === skillKey(b) || within(wordsOf(a), wordsOf(b)) || within(wordsOf(b), wordsOf(a));
/** A job phrase, not a skill: the taxonomy doesn't know it and it isn't a name ("Key Vault", "Databricks"). */
const isPhrase = (name: string) => {
  if (resolveSkill(TAXONOMY, name).known) return false;
  const words = name.trim().split(/\s+/);
  return words.length >= 2 ? words.slice(1).every((w) => !/^[A-Z]/.test(w)) : /^[a-z]/.test(name.trim());
};
const sameLabel = (a: string, b: string) => phraseKey(a) === phraseKey(b);
const isPermutation = (order: readonly string[], of: readonly string[]) => order.length === of.length && new Set(order).size === order.length && of.every((x) => order.includes(x));

interface Ctx {
  base: Doc;
  facts: ProfileFacts;
  tailor: TailorRunInput;
  asOf: { year: number; month?: number };
  /** The job, for what a removal may not take: its skills' only proof, a statement that fits it. */
  job?: { title: string; location?: string | null; skills: readonly string[] };
  /** The page as the review read it: its "header:<n>" and "summary:<n>" targets count from it. */
  original?: Doc;
}

type Outcome = { doc: Doc; removed?: ReviewedOut } | { why: string };

/** At most this many lines out in one review: it trims what doesn't fit, it never guts a page. */
export const MAX_REMOVALS = 6;

/** One edit, checked; the document it leaves, or why it was refused. */
function applyOne(doc: Doc, edit: ReviewEdit, ctx: Ctx): Outcome {
  const fixes = new Set(ctx.tailor.fixes);
  const ticked = new Set(ctx.tailor.added.map(skillKey));
  const target = edit.target ?? '';
  switch (edit.op) {
    case 'summary': {
      if (!fixes.has('summary')) return { why: 'part_off' };
      if (!edit.text || !edit.evidence?.length) return { why: 'no_text_or_evidence' };
      if (doc.summary && !keepsNumbers(doc.summary.text, edit.text)) return { why: 'dropped_a_number' };
      const next = { ...doc, summary: { id: 's', text: edit.text, evidence: edit.evidence, origin: 'generated' as const } };
      return verdict(next, 's', ctx);
    }
    case 'bullet':
      return rewriteBullet(doc, edit, ctx, fixes);
    case 'move_skill': {
      const groups = doc.skillGroups ?? [];
      const to = groups.findIndex((g) => sameLabel(g.label, edit.text ?? ''));
      const from = groups.findIndex((g) => g.names.some((n) => n.toLowerCase() === target.toLowerCase()));
      if (to < 0) return { why: 'no_such_line' };
      if (!fixes.has('skills') && !ticked.has(skillKey(target))) return { why: 'part_off' };
      if (!doc.skills.some((s) => s.name.toLowerCase() === target.toLowerCase())) return { why: 'no_such_skill' };
      if (from === to) return { why: 'already_there' };
      const name = doc.skills.find((s) => s.name.toLowerCase() === target.toLowerCase())!.name;
      const next: Groups = groups.map((g, i) => ({ ...g, names: i === to ? [...g.names.filter((n) => n !== name), name] : g.names.filter((n) => n.toLowerCase() !== target.toLowerCase()) }));
      if (next[to]!.names.length > 40) return { why: 'line_full' };
      return { doc: { ...doc, skillGroups: next.filter((g) => g.names.length > 0) } };
    }
    case 'drop_skill': {
      const skill = doc.skills.find((s) => s.name.toLowerCase() === target.toLowerCase());
      if (!skill) return { why: 'no_such_skill' };
      const isTicked = ticked.has(skillKey(skill.name));
      if (edit.keep) {
        const kept = doc.skills.find((s) => s.name.toLowerCase() === edit.keep!.toLowerCase());
        if (!kept || kept === skill) return { why: 'no_such_skill' };
        if (!duplicates(skill.name, kept.name)) return { why: 'not_a_duplicate' };
        if (!fixes.has('skills') && !isTicked) return { why: 'part_off' };
      } else if (!isTicked || !isPhrase(skill.name)) {
        // Only a ticked job phrase that is not a skill may go; a real skill the user ticked stays.
        return { why: 'real_skill' };
      }
      return { doc: withoutSkill(doc, skill.name) };
    }
    case 'rename_line': {
      if (!fixes.has('skills')) return { why: 'part_off' };
      const label = edit.text?.trim() ?? '';
      const groups = doc.skillGroups ?? [];
      const at = groups.findIndex((g) => sameLabel(g.label, target));
      if (at < 0) return { why: 'no_such_line' };
      if (!label || label.length > 40 || /\d/.test(label) || groups.some((g, i) => i !== at && sameLabel(g.label, label))) return { why: 'bad_label' };
      return { doc: { ...doc, skillGroups: groups.map((g, i) => (i === at ? { ...g, label } : g)) } };
    }
    case 'order_sections': {
      if (!doc.layout || !edit.order || !isPermutation(edit.order, doc.layout.order)) return { why: 'not_a_permutation' };
      return { doc: { ...doc, layout: { ...doc.layout, order: [...edit.order] } } };
    }
    case 'order_projects': {
      const ids = doc.projects.map((p) => p.factId);
      if (!edit.order || !isPermutation(edit.order, ids)) return { why: 'not_a_permutation' };
      return { doc: { ...doc, projects: edit.order.map((id) => doc.projects.find((p) => p.factId === id)!) } };
    }
    case 'order_bullets':
      return orderBullets(doc, target, edit.order);
    case 'remove_line':
      return removeLine(doc, target, ctx, fixes);
  }
}

/** The summary and every line of work, for "does anything else still show this skill?". */
const pageText = (doc: Doc) => [doc.summary?.text ?? '', ...doc.roles.flatMap((r) => r.bullets.map((b) => b.text)), ...doc.projects.flatMap((p) => p.bullets.map((b) => b.text))].join('\n');

/** The skills (ticked, or asked for by the job) this line names that nothing left on the page does. */
function onlyProof(after: Doc, text: string, ctx: Ctx): string[] {
  const check = leftOutChecker(TAXONOMY, [...ctx.tailor.added, ...(ctx.job?.skills ?? [])]);
  const still = new Set(check(pageText(after)).map(skillKey));
  return check(text).filter((k) => !still.has(skillKey(k)));
}

/**
 * Takes out one line that doesn't serve the job (§202): a header statement ("header:<index>"), a
 * summary sentence ("summary:<index>") or a bullet (its id). Refused for contact, a statement that
 * fits the job, the summary's last sentences, a role's last bullet and a skill's only proof.
 */
function removeLine(doc: Doc, target: string, ctx: Ctx, fixes: Set<string>): Outcome {
  const header = /^header:(\d+)$/.exec(target);
  if (header) {
    // The index is the original page's: the statement is found again by its text.
    const statement = headerStatements((ctx.original ?? doc).header).find((s) => s.index === Number(header[1]));
    if (!statement) return { why: 'not_a_statement' };
    if (ctx.job && statementFitsJob(statement.text, ctx.job)) return { why: 'fits_job' };
    const at = (doc.header?.items ?? []).findIndex((i) => i.text === statement.text);
    if (at < 0 || !doc.header) return { why: 'no_such_line' };
    const next = { ...doc, header: { ...doc.header, items: doc.header.items.filter((_, i) => i !== at) } };
    return { doc: next, removed: { where: 'Header', text: statement.text, reason: '', restore: { at: 'header', index: at, text: statement.text } } };
  }
  const summary = /^summary:(\d+)$/.exec(target);
  if (summary) {
    if (!fixes.has('summary')) return { why: 'part_off' };
    const text = summarySentences((ctx.original ?? doc).summary?.text)[Number(summary[1])];
    const sentences = summarySentences(doc.summary?.text);
    const at = text === undefined ? -1 : sentences.indexOf(text);
    if (text === undefined || at < 0 || !doc.summary) return { why: 'no_such_line' };
    const rest = sentences.filter((_, i) => i !== at).join(' ');
    if (rest.split(/\s+/).filter(Boolean).length < 12) return { why: 'summary_too_short' };
    const next = { ...doc, summary: { ...doc.summary, text: rest } };
    if (onlyProof(next, text, ctx).length) return { why: 'only_proof' };
    return { doc: next, removed: { where: 'Summary', text, reason: '', restore: { at: 'summary', index: at, text } } };
  }
  const role = doc.roles.find((r) => r.bullets.some((b) => b.id === target));
  if (role) {
    if (!rewrittenRoles(ctx.base, ctx.tailor).has(role.roleId)) return { why: 'part_off' };
    if (role.entries?.length) return { why: 'grouped' };
    if (role.bullets.length <= 1) return { why: 'last_bullet' };
    const at = role.bullets.findIndex((b) => b.id === target);
    const text = role.bullets[at]!.text;
    const next = { ...doc, roles: doc.roles.map((r) => (r === role ? { ...r, bullets: r.bullets.filter((b) => b.id !== target) } : r)) };
    if (onlyProof(next, text, ctx).length) return { why: 'only_proof' };
    return { doc: next, removed: { where: `${role.title} at ${role.company}`, text, reason: '', restore: { at: 'bullet', owner: role.roleId, index: at, text } } };
  }
  const project = doc.projects.find((p) => p.bullets.some((b) => b.id === target));
  if (!project) return { why: 'no_such_line' };
  if (!fixes.has('projects')) return { why: 'part_off' };
  if (project.bullets.length <= 1) return { why: 'last_bullet' };
  const at = project.bullets.findIndex((b) => b.id === target);
  const text = project.bullets[at]!.text;
  const next = { ...doc, projects: doc.projects.map((p) => (p === project ? { ...p, bullets: p.bullets.filter((b) => b.id !== target) } : p)) };
  if (onlyProof(next, text, ctx).length) return { why: 'only_proof' };
  return { doc: next, removed: { where: project.name, text, reason: '', restore: { at: 'bullet', owner: project.factId, index: at, text } } };
}

function rewriteBullet(doc: Doc, edit: ReviewEdit, ctx: Ctx, fixes: Set<string>): Outcome {
  const id = edit.target ?? '';
  if (!edit.text || !edit.evidence?.length) return { why: 'no_text_or_evidence' };
  if (isBoltOn(edit.text, leftOutChecker(TAXONOMY, ctx.tailor.added))) return { why: 'bolt_on' };
  const role = doc.roles.find((r) => r.bullets.some((b) => b.id === id));
  if (role) {
    if (!rewrittenRoles(ctx.base, ctx.tailor).has(role.roleId)) return { why: 'part_off' };
    if (!edit.evidence.every((e) => e.startsWith(`${role.roleId}#`))) return { why: 'cites_other' };
    const old = role.bullets.find((b) => b.id === id)!;
    if (!keepsNumbers(old.text, edit.text)) return { why: 'dropped_a_number' };
    const bullets = role.bullets.map((b) => (b.id === id ? { id, text: edit.text!, evidence: edit.evidence!, origin: 'generated' as const } : b));
    return verdict({ ...doc, roles: doc.roles.map((r) => (r === role ? { ...r, bullets } : r)) }, id, ctx);
  }
  const project = doc.projects.find((p) => p.bullets.some((b) => b.id === id));
  if (!project) return { why: 'no_such_line' };
  if (!fixes.has('projects')) return { why: 'part_off' };
  const own = ctx.facts.projects.find((p) => p.id === project.factId);
  const old = project.bullets.find((b) => b.id === id)!;
  if (!own || !keepsNumbers(old.text, edit.text)) return { why: own ? 'dropped_a_number' : 'no_facts' };
  const issues = checkProjectBullets({ id: own.id, name: own.name, lines: own.lines ?? [], skills: own.skills ?? [] }, [{ text: edit.text, evidence: edit.evidence }], TAXONOMY, leftOutChecker(TAXONOMY, ctx.tailor.skipped));
  if (issues.length) return { why: issues[0]!.code };
  const bullets = project.bullets.map((b) => (b.id === id ? { id, text: edit.text!, evidence: edit.evidence!, origin: 'generated' as const } : b));
  return { doc: { ...doc, projects: doc.projects.map((p) => (p === project ? { ...p, bullets } : p)) } };
}

function orderBullets(doc: Doc, where: string, order: readonly string[] | null): Outcome {
  if (!order) return { why: 'not_a_permutation' };
  const role = doc.roles.find((r) => r.roleId === where);
  if (role) {
    // A role whose file groups its bullets into client projects keeps the file's order.
    if (role.entries?.length) return { why: 'grouped' };
    if (!isPermutation(order, role.bullets.map((b) => b.id))) return { why: 'not_a_permutation' };
    return { doc: { ...doc, roles: doc.roles.map((r) => (r === role ? { ...r, bullets: order.map((id) => r.bullets.find((b) => b.id === id)!) } : r)) } };
  }
  const project = doc.projects.find((p) => p.factId === where);
  if (!project || !isPermutation(order, project.bullets.map((b) => b.id))) return { why: 'not_a_permutation' };
  return { doc: { ...doc, projects: doc.projects.map((p) => (p === project ? { ...p, bullets: order.map((id) => p.bullets.find((b) => b.id === id)!) } : p)) } };
}

/** The claim ledger's word on one written claim: refused when it is a violation. */
function verdict(next: Doc, claimId: string, ctx: Ctx): Outcome {
  const result = ledgerOf(next, ctx.facts, ctx.asOf, ctx.tailor.skipped).results.find((r) => r.claimId === claimId);
  return result?.status === 'violation' ? { why: result.issues.map((i) => i.code).join(',') || 'violation' } : { doc: next };
}

const withoutSkill = (doc: Doc, name: string): Doc => ({
  ...doc,
  skills: doc.skills.filter((s) => s.name !== name),
  ...(doc.skillGroups ? { skillGroups: doc.skillGroups.map((g) => ({ ...g, names: g.names.filter((n) => n !== name) })).filter((g) => g.names.length > 0) } : {}),
});

/** Every edit in the model's order, each checked against the document the ones before it left. */
export function applyReview(doc: Doc, review: z.infer<typeof reviewSchema>, ctx: Ctx): { doc: Doc; record: ReviewRecord } {
  const record = emptyReview();
  record.issues = review.issues;
  const withOriginal = { ...ctx, original: doc };
  let current = doc;
  for (const edit of review.edits) {
    if (edit.op === 'remove_line' && record.removed.length >= MAX_REMOVALS) {
      record.refused.push({ op: edit.op, target: edit.target, why: 'too_many_removals' });
      continue;
    }
    const outcome = applyOne(current, edit, withOriginal);
    if ('why' in outcome) {
      record.refused.push({ op: edit.op, target: edit.target, why: outcome.why });
      continue;
    }
    current = outcome.doc;
    if (outcome.removed) record.removed.push({ ...outcome.removed, reason: edit.reason });
    record.applied.push({ op: edit.op, target: edit.target, ...(edit.text ? { text: edit.text } : {}), reason: edit.reason });
  }
  return { doc: reconcileStructure(current), record };
}
