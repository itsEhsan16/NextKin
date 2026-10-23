import type { ResumeContent } from '../models';

/**
 * The text of the document the assistant was opened with (V2 §7.16: "answers reference that
 * document's actual content"; owner, 2026-10-18: it reads everything in the resume). Built on the
 * server only; the mock never sends it.
 *
 * Structurally, the contact block (`contact`, `links`) is not read at all, and every string goes
 * through the caller's `redact` (contact-shaped text, links and the user's own names, G5). The
 * caps are deterministic so the same document always yields the same prompt: the oldest roles go
 * first when the whole would not fit.
 */
export type AssistantDocumentBody = {
  headline?: string;
  summary?: string;
  skills: string[];
  roles: {
    title: string;
    company: string;
    period: string;
    location?: string;
    skills: string[];
    bullets: string[];
  }[];
  education: { institution: string; degree: string; period?: string }[];
  certifications: string[];
  projects: { name: string; description?: string; bullets: string[] }[];
};

export const BODY_LIMITS = {
  roles: 12,
  bulletsPerRole: 8,
  bulletChars: 400,
  projects: 6,
  totalChars: 24_000,
} as const;

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const size = (body: AssistantDocumentBody) => JSON.stringify(body).length;

export function documentBody(
  content: ResumeContent,
  redact: (text: string) => string,
): AssistantDocumentBody {
  const r = (text: string) => redact(text).trim();
  const lines = (items: readonly string[], max: number) =>
    items
      .map((item) => clip(r(item), BODY_LIMITS.bulletChars))
      .filter(Boolean)
      .slice(0, max);

  const body: AssistantDocumentBody = {
    ...(content.headline?.trim() ? { headline: r(content.headline) } : {}),
    ...(content.summary.trim() ? { summary: clip(r(content.summary), 2000) } : {}),
    skills: content.skills.map(r).filter(Boolean),
    roles: content.experience.slice(0, BODY_LIMITS.roles).map((role) => ({
      title: r(role.title),
      company: r(role.company),
      period: role.period,
      ...(role.location?.trim() ? { location: r(role.location) } : {}),
      skills: (role.skills ?? []).map(r).filter(Boolean),
      bullets: lines(role.bullets, BODY_LIMITS.bulletsPerRole),
    })),
    education: content.education.map((e) => ({
      institution: r(e.institution),
      degree: r(e.degree),
      ...(e.period ? { period: e.period } : {}),
    })),
    certifications: content.certifications.map(r).filter(Boolean),
    projects: content.projects.slice(0, BODY_LIMITS.projects).map((p) => ({
      name: r(p.name),
      ...(p.description.trim() ? { description: clip(r(p.description), 600) } : {}),
      bullets: lines(p.bullets, BODY_LIMITS.bulletsPerRole),
    })),
  };

  // Over the budget: drop the oldest roles' bullets first, then the oldest roles themselves.
  for (let i = body.roles.length - 1; i > 0 && size(body) > BODY_LIMITS.totalChars; i--) {
    body.roles[i] = { ...body.roles[i]!, bullets: [] };
  }
  while (body.roles.length > 1 && size(body) > BODY_LIMITS.totalChars) body.roles.pop();
  return body;
}
