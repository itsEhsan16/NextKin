import {
  DEFAULT_RESUME_TEMPLATE,
  STANDARD_SECTION_KEYS,
  type DocContactItem,
  type DocLine,
  type DocSectionKey,
  type ResumeDocument,
  type ResumeDocumentWrite,
} from '../models/resumeDocument';
import type { CanonicalClaim, CanonicalResumeJson } from '../schemas/resumeContent';
import { bulletGroups, reconcileStructure } from './structure';

/**
 * The editor's document over the canonical resume (toreview §124). `documentOf` reads one;
 * `applyDocument` writes one back. A line keeps its claim — id, evidence, origin — while its text
 * is unchanged; a changed or new line is the user's own (Q-03). Unlike a section save, a whole
 * document save never confirms a Zero Resume guess on its own: that stays the review's job (§7.9).
 *
 * Pure and phone-safe: the server and the mock run exactly these.
 */

/** Who the account says the resume belongs to: the header a resume without its own one prints. */
export type DocumentOwner = { name: string; email?: string; phone?: string; location?: string };

/** Required canonical text the user left blank, stored until they fill it; read back as blank. */
const PLACEHOLDER = /^\s*\[[^\]]*\]\s*$/;
const shown = (value: string | undefined | null) => (value && !PLACEHOLDER.test(value) ? value : '');
const orHold = (value: string, hold: string) => value.trim() || hold;

/** A contact item's link, from what it says when the user gave none. */
export function contactUrl(item: { text: string; url?: string }): string | undefined {
  const url = item.url?.trim();
  if (url) return /^(https:\/\/|mailto:|tel:)/i.test(url) ? url : /^http:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : `https://${url}`;
  const t = item.text.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  if (/^\+?[\d\s().-]{7,}$/.test(t)) return `tel:${t.replace(/[^\d+]/g, '')}`;
  if (/^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t) && !/\s/.test(t)) return t.startsWith('https://') ? t : `https://${t.replace(/^https?:\/\//i, '')}`;
  return undefined;
}

function ownerItems(owner: DocumentOwner): DocContactItem[] {
  return [
    ...(owner.location ? [{ id: 'c-location', text: owner.location }] : []),
    ...(owner.phone ? [{ id: 'c-phone', text: owner.phone }] : []),
    ...(owner.email ? [{ id: 'c-email', text: owner.email }] : []),
  ];
}

const docLines = (claims: readonly CanonicalClaim[]): DocLine[] => claims.map((c) => ({ id: c.id, text: c.text }));

export function documentOf(doc: CanonicalResumeJson, ids: { resumeId: string; versionId: string; revision: string }, owner: DocumentOwner): ResumeDocument {
  const custom = (doc.sections ?? []).map((s) => ({
    id: s.id,
    heading: shown(s.heading),
    entries: s.entries.map((e, i) => ({ id: `${s.id}-e${i}`, title: shown(e.title), subtitle: e.subtitle ?? '', right: e.right ?? '', subRight: e.subRight ?? '', bullets: docLines(e.bullets) })),
    lines: docLines(s.lines),
  }));
  const keys = new Set<string>([...STANDARD_SECTION_KEYS, ...custom.map((s) => `x:${s.id}`)]);
  const order = [...new Set((doc.layout?.order ?? []).filter((k) => keys.has(k)))] as DocSectionKey[];
  for (const key of keys) if (!order.includes(key as DocSectionKey)) order.push(key as DocSectionKey);
  const grouped = new Set((doc.skillGroups ?? []).flatMap((g) => g.names.map((n) => n.toLowerCase())));
  return {
    resumeId: ids.resumeId,
    versionId: ids.versionId,
    revision: ids.revision,
    header: {
      name: doc.header?.name ?? owner.name,
      headline: doc.headline ?? '',
      items: doc.header ? doc.header.items.map((item, i) => ({ id: `c${i}`, text: item.text, ...(item.url ? { url: item.url } : {}) })) : ownerItems(owner),
    },
    summary: doc.summary?.text ?? '',
    skills: {
      groups: (doc.skillGroups ?? []).map((g, i) => ({ id: `g${i}`, label: g.label, skills: [...g.names] })),
      loose: doc.skills.map((s) => s.name).filter((n) => !grouped.has(n.toLowerCase())),
    },
    experience: doc.roles.map((role) => {
      const groups = bulletGroups(role);
      return {
        id: role.roleId,
        company: shown(role.company),
        title: shown(role.title),
        location: role.location ?? '',
        start: role.start,
        end: role.end,
        bullets: docLines(groups.find((g) => !g.title)?.bullets ?? []),
        groups: groups.filter((g) => g.title).map((g, i) => ({ id: `${role.roleId}-g${i}`, title: g.title!, tech: g.tech ?? '', bullets: docLines(g.bullets) })),
        ...(role.assumed || role.bullets.some((b) => b.origin === 'assumed') ? { assumed: true } : {}),
      };
    }),
    projects: doc.projects.map((p) => ({ id: p.factId, name: shown(p.name), description: p.description ?? '', tech: p.tech ?? '', start: p.start ?? null, end: p.end ?? null, bullets: docLines(p.bullets) })),
    education: doc.education.map((e) => ({
      id: e.factId,
      institution: shown(e.institution),
      degree: shown(e.degree),
      field: e.field ?? '',
      start: e.start ?? null,
      end: e.end ?? null,
      gpa: e.gpa ?? '',
      location: e.location ?? '',
      ...(e.assumed ? { assumed: true } : {}),
    })),
    certifications: doc.certifications.map((c) => ({ id: c.factId, name: c.name, issuer: c.issuer ?? '' })),
    custom,
    order,
    headings: Object.fromEntries(Object.entries(doc.layout?.headings ?? {}).filter(([k]) => (STANDARD_SECTION_KEYS as readonly string[]).includes(k))),
    template: doc.template ?? DEFAULT_RESUME_TEMPLATE,
    ...(doc.skills.some((s) => s.origin === 'assumed') || doc.roles.some((r) => r.assumed) || doc.education.some((e) => e.assumed) ? { pendingReview: true } : {}),
  };
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Ids unique in the written document: a known one is kept, a fresh client one used if free. */
function idPool(doc: CanonicalResumeJson) {
  const old = new Set<string>([
    ...(doc.summary ? [doc.summary.id] : []),
    ...doc.skills.map((s) => s.id),
    ...doc.roles.flatMap((r) => [r.roleId, ...r.bullets.map((b) => b.id)]),
    ...doc.projects.flatMap((p) => [p.factId, ...p.bullets.map((b) => b.id)]),
    ...doc.education.map((e) => e.factId),
    ...doc.certifications.map((c) => c.factId),
    ...(doc.sections ?? []).flatMap((s) => [...s.lines.map((l) => l.id), ...s.entries.flatMap((e) => e.bullets.map((b) => b.id))]),
  ]);
  const used = new Set<string>();
  const mint = (prefix: string) => {
    let n = 0;
    while (old.has(`${prefix}${n}`) || used.has(`${prefix}${n}`)) n += 1;
    used.add(`${prefix}${n}`);
    return `${prefix}${n}`;
  };
  /** `wanted` when it is this container's own id or a fresh safe one; otherwise a new one. */
  const take = (wanted: string, own: boolean, prefix: string) => {
    if (!used.has(wanted) && (own || (!old.has(wanted) && SAFE_ID.test(wanted)))) {
      used.add(wanted);
      return wanted;
    }
    return mint(prefix);
  };
  return { take, mint };
}

type Pool = ReturnType<typeof idPool>;

/** The lines as claims: unchanged keeps its claim, changed keeps its id as the user's, new is new. */
function claimsOf(previous: readonly CanonicalClaim[], lines: readonly DocLine[], pool: Pool, prefix: string): CanonicalClaim[] {
  return lines
    .filter((l) => l.text.trim().length > 0)
    .map((l) => {
      const text = l.text.trim();
      const prev = previous.find((c) => c.id === l.id);
      if (prev && prev.text === text) return pool.take(prev.id, true, prefix) === prev.id ? prev : { ...prev, id: pool.mint(prefix) };
      return { id: pool.take(l.id, Boolean(prev), prefix), text, evidence: [], origin: 'user' as const };
    });
}

const unique = (names: readonly string[]) => {
  const seen = new Set<string>();
  return names.map((n) => n.trim()).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
};

const isBlankRole = (r: ResumeDocumentWrite['experience'][number]) => !r.company.trim() && !r.title.trim() && r.bullets.every((b) => !b.text.trim()) && r.groups.length === 0;

export function applyDocument(doc: CanonicalResumeJson, write: ResumeDocumentWrite): CanonicalResumeJson {
  const pool = idPool(doc);
  const name = write.header.name.trim();
  const items = write.header.items.filter((i) => i.text.trim()).map((i) => {
    const url = contactUrl(i);
    return { text: i.text.trim(), ...(url ? { url } : {}) };
  });

  const names = unique([...write.skills.groups.flatMap((g) => g.skills), ...write.skills.loose]);
  const skills = names.map((n) => doc.skills.find((s) => s.name.toLowerCase() === n.toLowerCase()) ?? { id: pool.mint('user-k'), name: n, evidence: [], origin: 'user' as const }).map((s, i) => ({ ...s, name: names[i]! }));
  const skillGroups = write.skills.groups
    .map((g) => ({ label: g.label.trim(), names: unique(g.skills) }))
    .filter((g) => g.label && g.names.length);

  const roles = write.experience.filter((r) => !isBlankRole(r)).map((r) => {
    const old = doc.roles.find((x) => x.roleId === r.id);
    const roleId = pool.take(r.id, Boolean(old), 'user-r');
    const previous = old?.bullets ?? [];
    const loose = claimsOf(previous, r.bullets, pool, `${roleId}-u`);
    const groups = r.groups.map((g) => ({ g, claims: claimsOf(previous, g.bullets, pool, `${roleId}-u`) }));
    return {
      roleId,
      company: orHold(r.company, '[Company Name]'),
      title: orHold(r.title, '[Job Title]'),
      start: r.start,
      end: r.end,
      ...(r.location.trim() ? { location: r.location.trim() } : {}),
      skills: [...(old?.skills ?? [])],
      bullets: [...loose, ...groups.flatMap((x) => x.claims)].slice(0, 12),
      ...(groups.some((x) => x.g.title.trim())
        ? { entries: groups.filter((x) => x.g.title.trim()).map((x) => ({ title: x.g.title.trim(), ...(x.g.tech.trim() ? { tech: x.g.tech.trim() } : {}), bulletIds: x.claims.map((c) => c.id) })).slice(0, 6) }
        : {}),
      ...(old?.assumed && r.assumed ? { assumed: true as const } : {}),
    };
  });

  const projects = write.projects.filter((p) => p.name.trim() || p.description.trim() || p.bullets.some((b) => b.text.trim())).map((p) => {
    const old = doc.projects.find((x) => x.factId === p.id);
    const factId = pool.take(p.id, Boolean(old), 'user-p');
    return {
      factId,
      name: orHold(p.name, '[Project Name]'),
      ...(p.description.trim() ? { description: p.description.trim() } : {}),
      ...(p.tech.trim() ? { tech: p.tech.trim() } : {}),
      ...(p.start !== null ? { start: p.start } : {}),
      ...(p.end !== null || p.start !== null ? { end: p.end } : {}),
      bullets: claimsOf(old?.bullets ?? [], p.bullets, pool, `${factId}-u`),
    };
  });

  const education = write.education.filter((e) => e.institution.trim() || e.degree.trim()).map((e) => {
    const old = doc.education.find((x) => x.factId === e.id);
    return {
      factId: pool.take(e.id, Boolean(old), 'user-e'),
      institution: orHold(e.institution, '[Institution Name]'),
      degree: orHold(e.degree, '[Degree]'),
      ...(e.field.trim() ? { field: e.field.trim() } : {}),
      start: e.start,
      end: e.end,
      ...(e.gpa.trim() ? { gpa: e.gpa.trim() } : {}),
      ...(e.location.trim() ? { location: e.location.trim() } : {}),
      ...(old?.assumed && e.assumed ? { assumed: true as const } : {}),
    };
  });

  const certifications = write.certifications.filter((c) => c.name.trim()).map((c) => {
    const old = doc.certifications.find((x) => x.factId === c.id);
    return { factId: pool.take(c.id, Boolean(old), 'user-c'), name: c.name.trim(), ...(c.issuer.trim() ? { issuer: c.issuer.trim() } : {}) };
  });

  const sections = write.custom.map((s) => {
    const old = doc.sections?.find((x) => x.id === s.id);
    const previous = [...(old?.lines ?? []), ...(old?.entries.flatMap((e) => e.bullets) ?? [])];
    return {
      id: s.id,
      heading: orHold(s.heading, '[Section]'),
      entries: s.entries.filter((e) => e.title.trim() || e.bullets.some((b) => b.text.trim())).map((e) => ({
        title: orHold(e.title, '[Title]'),
        ...(e.subtitle.trim() ? { subtitle: e.subtitle.trim() } : {}),
        ...(e.right.trim() ? { right: e.right.trim() } : {}),
        ...(e.subRight.trim() ? { subRight: e.subRight.trim() } : {}),
        bullets: claimsOf(previous, e.bullets, pool, `${s.id}-b`),
      })),
      lines: claimsOf(previous, s.lines, pool, `${s.id}-l`),
    };
  });

  const summaryText = write.summary.trim();
  const summary = !summaryText ? undefined : doc.summary?.text === summaryText ? doc.summary : { id: doc.summary?.id ?? 's', text: summaryText, evidence: [], origin: 'user' as const };
  const headings = Object.fromEntries(Object.entries(write.headings).map(([k, v]) => [k, (v ?? '').trim()] as const).filter(([k, v]) => v && !k.startsWith('x:')));

  const { summary: _s, headline: _h, header: _hd, skillGroups: _g, sections: _x, layout: _l, template: _t, ...rest } = doc;
  return reconcileStructure({
    ...rest,
    ...(summary ? { summary } : {}),
    ...(write.header.headline.trim() ? { headline: write.header.headline.trim() } : {}),
    ...(name ? { header: { name, items } } : {}),
    skills,
    ...(skillGroups.length ? { skillGroups } : {}),
    roles,
    projects,
    education,
    certifications,
    ...(sections.length ? { sections } : {}),
    layout: { order: [...write.order], headings },
    template: write.template,
  });
}
