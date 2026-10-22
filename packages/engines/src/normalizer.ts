/**
 * The skill normalizer (ImBackendImplementationPlan P8-02, old plan Q-02): one way to turn a
 * written skill into a canonical id, used by the requirement ledger, the timeline post-check, the
 * rubric and (from P9) inline profile validation.
 *
 * - Aliases are matched as token sequences over `tokenize`, never with `\b` regexes, so C++, C#,
 *   .NET, Node.js and CI/CD match exactly and Java never matches inside JavaScript.
 * - The longest alias wins ("Spring Boot" over "Spring", "React Native" over "React").
 * - A version after a name is kept and does not stop the match ("Python 3", "Angular 2+"); a version
 *   glued to a name resolves too ("Python3", "Vue3").
 * - Ambiguous names (Go, R, C, Swift, Spring, Rust, React…) count only in skill context: a whole list
 *   item, a list beside other skills, or a cue word ("Go services", "Rust developer",
 *   "Go-Entwicklung"). "go-to-market", "R&D", "C-level" and "Spring 2020" never resolve.
 * - A phrase the taxonomy does not know still gets a stable id (`x:<words>`), matched as a whole
 *   token sequence, so an unlisted JD skill can be met exactly and never by substring.
 */

import { compareCodePoints } from './bps';
import { keysOf, phraseKey, tokenize, type Token } from './text';

export type SkillCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'tool'
  | 'methodology'
  | 'practice'
  | 'design'
  | 'domain';

export interface SkillDef {
  id: string;
  name: string;
  category: SkillCategory;
  /** A leading `~` marks an alias that is itself an ordinary word or unit (`~ml`). */
  aliases: readonly string[];
  /** The name is also an ordinary word or letter (applies to one-word names). */
  ambiguous?: boolean;
}

export interface Taxonomy {
  id: 'taxonomy';
  version: string;
  skills: readonly SkillDef[];
}

/** A resolved skill. Unknown phrases get `x:` ids and `known: false`. */
export interface SkillRef {
  id: string;
  name: string;
  known: boolean;
}

export interface Mention {
  skillId: string;
  name: string;
  /** The text as written, e.g. "Postgres" for PostgreSQL. */
  surface: string;
  start: number;
  end: number;
  version?: string;
}

interface Terminal {
  skillId: string;
  ambiguous: boolean;
}

interface TrieNode {
  next: Map<string, TrieNode>;
  terminal?: Terminal;
}

interface Index {
  root: TrieNode;
  byId: Map<string, SkillDef>;
}

const VERSION = /^v?\d+(?:\.\d+)*(?:\.x)?\+?$/;
const YEAR = /^(?:19|20)\d{2}$/;
const GLUED_VERSION = /^(\p{L}[\p{L}+#]*?)(\d+(?:\.\d+)*\+?)$/u;
const PLAIN_WORD = /^\p{L}+$/u;
const GLUE_CATEGORIES: ReadonlySet<SkillCategory> = new Set(['language', 'framework', 'library', 'database', 'tool']);

/** Words that make an adjacent ambiguous name a skill: "Go services", "Rust developer". */
const CUES_AFTER = new Set([
  'service', 'services', 'microservices', 'app', 'apps', 'application', 'applications', 'component',
  'components', 'codebase', 'sdk', 'api', 'apis', 'backend', 'frontend', 'developer', 'developers',
  'engineer', 'engineers', 'engineering', 'programming', 'language', 'code', 'framework', 'library',
  'stack', 'server', 'servers', 'charts', 'cookbooks', 'manifests', 'scripts', 'packages', 'modules',
  'tests', 'notebooks', 'hooks', 'entwicklung', 'entwickler', 'kenntnisse', 'programmierung',
  'anwendungen',
]);
/** Two-word cues before a name: "written in Go", "built with React". */
const CUES_BEFORE: readonly (readonly [string, string])[] = [
  ['written', 'in'], ['programming', 'in'], ['coded', 'in'], ['built', 'with'], ['built', 'in'],
  ['developed', 'in'], ['developed', 'with'], ['experience', 'with'], ['experience', 'in'],
  ['proficient', 'in'], ['proficiency', 'in'], ['kenntnisse', 'in'], ['services', 'in'], ['service', 'in'],
  ['microservices', 'in'], ['apis', 'in'], ['code', 'in'], ['tools', 'in'], ['systems', 'in'], ['backend', 'in'],
];
/** One-word usage cues before a capitalised name, mid-sentence: "built it with Swift". */
const USAGE_BEFORE = new Set(['with', 'using', 'used', 'to', 'into', 'via', 'adopted', 'introduced', 'mit']);
/** What may sit between two skills in a list: "Python, Go and Rust", "Go / Rust". */
const LIST_SEPARATORS = new Set([',', '/', '|', '·', '•', '(', ')', ';', 'and', 'or', 'und', 'oder']);

const indexes = new WeakMap<Taxonomy, Index>();

function addKey(root: TrieNode, keys: readonly string[], terminal: Terminal): void {
  if (keys.length === 0) return;
  let node = root;
  for (const key of keys) {
    let child = node.next.get(key);
    if (!child) {
      child = { next: new Map() };
      node.next.set(key, child);
    }
    node = child;
  }
  // The first entry for a key wins; the taxonomy test forbids duplicates anyway.
  node.terminal ??= terminal;
}

function buildIndex(taxonomy: Taxonomy): Index {
  const root: TrieNode = { next: new Map() };
  const byId = new Map<string, SkillDef>();
  for (const skill of taxonomy.skills) {
    byId.set(skill.id, skill);
    const entries = [skill.name, ...skill.aliases];
    for (const entry of entries) {
      const explicit = entry.startsWith('~');
      const text = explicit ? entry.slice(1) : entry;
      const keys = keysOf(text);
      // The name is ambiguous when the skill says so and it is one plain word; an alias only when
      // it is marked `~`. So Go is ambiguous and Golang is not.
      const ambiguous =
        explicit || (entry === skill.name && skill.ambiguous === true && keys.length === 1 && PLAIN_WORD.test(keys[0]!));
      addKey(root, keys, { skillId: skill.id, ambiguous });
      // "react.js" also matches "reactjs".
      if (keys.length === 1 && keys[0]!.endsWith('.js')) {
        addKey(root, [keys[0]!.slice(0, -3) + 'js'], { skillId: skill.id, ambiguous: false });
      }
    }
  }
  return { root, byId };
}

function indexOf(taxonomy: Taxonomy): Index {
  let index = indexes.get(taxonomy);
  if (!index) {
    index = buildIndex(taxonomy);
    indexes.set(taxonomy, index);
  }
  return index;
}

interface Candidate {
  terminal: Terminal;
  from: number;
  /** Token index after the name (and its version, when one follows). */
  to: number;
  nameEnd: number;
  version?: string;
  accepted: boolean;
}

function longestMatch(root: TrieNode, tokens: readonly Token[], from: number): { terminal: Terminal; to: number } | null {
  let node: TrieNode | undefined = root;
  let best: { terminal: Terminal; to: number } | null = null;
  for (let i = from; i < tokens.length && node; i += 1) {
    node = node.next.get(tokens[i]!.key);
    if (node?.terminal) best = { terminal: node.terminal, to: i + 1 };
  }
  return best;
}

function gluedMatch(index: Index, token: Token): { terminal: Terminal; version: string } | null {
  const glued = GLUED_VERSION.exec(token.key);
  if (!glued) return null;
  const terminal = index.root.next.get(glued[1]!)?.terminal;
  if (!terminal || terminal.ambiguous || glued[1]!.length < 3) return null;
  const skill = index.byId.get(terminal.skillId);
  if (!skill || !GLUE_CATEGORIES.has(skill.category)) return null;
  return { terminal, version: glued[2]! };
}

function isCue(token: Token | undefined): boolean {
  return token !== undefined && CUES_AFTER.has(token.key);
}

/** Skill context for an ambiguous name, from the words around it. */
function contextAccepts(tokens: readonly Token[], c: Candidate, wholeItem: boolean): boolean | 'list' {
  if (wholeItem) return true;
  const before = tokens[c.from - 1];
  const after = tokens[c.to];
  // Joined by a hyphen or ampersand to a non-cue word: go-to-market, R&D, C-level.
  if (before && (before.key === '-' || before.key === '&')) return false;
  if (after && after.key === '&') return false;
  if (after && after.key === '-') return isCue(tokens[c.to + 1]);
  if (after && YEAR.test(after.key)) return false;
  const surface = tokens.slice(c.from, c.nameEnd).map((t) => t.raw).join('');
  const lowercase = surface === surface.toLowerCase();
  if (!lowercase) {
    if (isCue(after)) return true;
    const b2 = tokens[c.from - 2];
    if (before && b2 && CUES_BEFORE.some(([w1, w2]) => b2.key === w1 && before.key === w2)) return true;
    // "tooling with Swift", "migrated to React": a capitalised name after a usage word, when what
    // follows cannot make it part of a longer noun ("with Chef Ramsay", "to Express delivery").
    if (before && USAGE_BEFORE.has(before.key) && quietAfter(tokens, c.to)) return true;
  }
  return 'list';
}

/** Words that may follow a name without turning it into part of another noun. */
const QUIET_AFTER = new Set(['for', 'and', 'or', 'in', 'on', 'to', 'with', 'as', 'from', 'across', 'over', 'during', 'und', 'für']);

/** After the name: the end, punctuation other than a possessive, a cue or a quiet word. */
function quietAfter(tokens: readonly Token[], at: number): boolean {
  const next = tokens[at];
  if (!next) return true;
  if (next.kind === 'punct') return next.key !== "'" && next.key !== '’';
  return isCue(next) || QUIET_AFTER.has(next.key);
}

function separatedOnlyByList(tokens: readonly Token[], from: number, to: number): boolean {
  if (to <= from) return true;
  for (let i = from; i < to; i += 1) if (!LIST_SEPARATORS.has(tokens[i]!.key)) return false;
  return true;
}

/** Every skill mentioned in a text. `item` treats the whole text as one list entry. */
export function mentionsIn(taxonomy: Taxonomy, text: string, options: { item?: boolean } = {}): Mention[] {
  const index = indexOf(taxonomy);
  const tokens = tokenize(text);
  const words = tokens.filter((t) => t.kind === 'word').length;
  const candidates: Candidate[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.kind === 'punct' && token.key !== '.') {
      i += 1;
      continue;
    }
    const match = longestMatch(index.root, tokens, i);
    if (match) {
      let to = match.to;
      let version: string | undefined;
      const next = tokens[to];
      if (next && next.kind === 'word' && VERSION.test(next.key) && !YEAR.test(next.key)) {
        version = next.raw;
        to += 1;
      }
      candidates.push({ terminal: match.terminal, from: i, to, nameEnd: match.to, version, accepted: !match.terminal.ambiguous });
      i = to;
      continue;
    }
    const glued = gluedMatch(index, token);
    if (glued) {
      candidates.push({ terminal: glued.terminal, from: i, to: i + 1, nameEnd: i + 1, version: glued.version, accepted: true });
    }
    i += 1;
  }

  // Ambiguous names: direct context first, then list membership beside accepted skills.
  const pending: Candidate[] = [];
  for (const c of candidates) {
    if (c.accepted) continue;
    const wholeItem =
      options.item === true &&
      candidates.length === 1 &&
      tokens.every((t, k) => t.kind !== 'word' || (k >= c.from && k < c.to)) &&
      words > 0;
    const verdict = contextAccepts(tokens, c, wholeItem);
    if (verdict === true) c.accepted = true;
    else if (verdict === 'list') pending.push(c);
  }
  let changed = true;
  while (changed && pending.length > 0) {
    changed = false;
    for (let k = pending.length - 1; k >= 0; k -= 1) {
      const c = pending[k]!;
      const position = candidates.indexOf(c);
      const prev = candidates[position - 1];
      const next = candidates[position + 1];
      const joined =
        (prev?.accepted === true && separatedOnlyByList(tokens, prev.to, c.from)) ||
        (next?.accepted === true && separatedOnlyByList(tokens, c.to, next.from));
      if (joined) {
        c.accepted = true;
        pending.splice(k, 1);
        changed = true;
      }
    }
  }

  return candidates
    .filter((c) => c.accepted)
    .map((c) => {
      const skill = index.byId.get(c.terminal.skillId)!;
      const first = tokens[c.from]!;
      const last = tokens[c.nameEnd - 1]!;
      return {
        skillId: skill.id,
        name: skill.name,
        surface: text.slice(first.start, last.end),
        start: first.start,
        end: tokens[c.to - 1]!.end,
        ...(c.version ? { version: c.version } : {}),
      };
    });
}

/**
 * Resolves one written skill (a list entry, a JD chip, a profile tag). A known skill gets its
 * canonical id; anything else gets a stable `x:` id built from its words, so "Stakeholder
 * alignment" in a JD and in a resume still meet, exactly.
 */
export function resolveSkill(taxonomy: Taxonomy, written: string): SkillRef {
  const text = written.trim();
  const mentions = mentionsIn(taxonomy, text, { item: true });
  const words = tokenize(text).filter((t) => t.kind === 'word');
  if (mentions.length === 1) {
    const m = mentions[0]!;
    const covered = words.every((w) => w.start >= m.start && w.end <= m.end);
    if (covered) return { id: m.skillId, name: m.name, known: true };
  }
  return { id: `x:${phraseKey(text)}`, name: text, known: false };
}

/** Whether a resolved skill appears in a text, as a whole mention or whole token sequence. */
export function findSkill(taxonomy: Taxonomy, text: string, ref: SkillRef): Mention[] {
  if (ref.known) return mentionsIn(taxonomy, text).filter((m) => m.skillId === ref.id);
  const phrase = keysOf(ref.name);
  if (phrase.length === 0) return [];
  const tokens = tokenize(text);
  const found: Mention[] = [];
  for (let i = 0; i + phrase.length <= tokens.length; i += 1) {
    if (phrase.every((key, k) => tokens[i + k]!.key === key)) {
      const first = tokens[i]!;
      const last = tokens[i + phrase.length - 1]!;
      found.push({ skillId: ref.id, name: ref.name, surface: text.slice(first.start, last.end), start: first.start, end: last.end });
      i += phrase.length - 1;
    }
  }
  return found;
}

/** A skill's definition by id. */
export function skillById(taxonomy: Taxonomy, id: string): SkillDef | undefined {
  return indexOf(taxonomy).byId.get(id);
}

/** Distinct ids, in code-point order: the stable form every ledger stores. */
export function uniqueIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort(compareCodePoints);
}
